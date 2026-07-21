import { describe, expect, it } from 'vitest'
import { createTestDb, insertProduct } from '../testUtils'
import { buildSpiritCombo } from './promotions'

function seedSpiritProducts(db: ReturnType<typeof createTestDb>, opts: { ice?: boolean } = {}): {
  bottleId: number
  mixerId: number
} {
  const bottleId = insertProduct(db, { name: 'Klipdrift 750ml', sellPriceCents: 9500 })
  const mixerId = insertProduct(db, { name: 'Coke 300ml', sellPriceCents: 1800 })
  if (opts.ice !== false) insertProduct(db, { name: 'Ice', sellPriceCents: 500 })
  return { bottleId, mixerId }
}

describe('buildSpiritCombo', () => {
  it('prices the combo at bottle + charge extra and includes bottle, ice and mixer', () => {
    const db = createTestDb()
    const { bottleId, mixerId } = seedSpiritProducts(db)

    const built = buildSpiritCombo(db, { bottleProductId: bottleId, mixerProductId: mixerId, chargeExtraCents: 3000 })

    expect(built.name).toBe('Klipdrift 750ml + Coke 300ml')
    expect(built.priceCents).toBe(12500) // 9500 bottle + 3000 extra
    expect(built.chargeExtraCents).toBe(3000)
    expect(built.items.map((i) => i.role)).toEqual(['bottle', 'ice', 'mixer'])
    // All three deduct from stock, one each.
    expect(built.items.every((i) => i.qty === 1)).toBe(true)
    expect(built.items.find((i) => i.role === 'mixer')?.productId).toBe(mixerId)
  })

  it('refuses to build when no active Ice product exists', () => {
    const db = createTestDb()
    const { bottleId, mixerId } = seedSpiritProducts(db, { ice: false })
    expect(() =>
      buildSpiritCombo(db, { bottleProductId: bottleId, mixerProductId: mixerId, chargeExtraCents: 3000 })
    ).toThrow(/Ice/)
  })

  it('rejects a negative charge extra', () => {
    const db = createTestDb()
    const { bottleId, mixerId } = seedSpiritProducts(db)
    expect(() =>
      buildSpiritCombo(db, { bottleProductId: bottleId, mixerProductId: mixerId, chargeExtraCents: -100 })
    ).toThrow(/negative/)
  })

  it('rejects a missing bottle', () => {
    const db = createTestDb()
    const { mixerId } = seedSpiritProducts(db)
    expect(() =>
      buildSpiritCombo(db, { bottleProductId: 99999, mixerProductId: mixerId, chargeExtraCents: 0 })
    ).toThrow(/Bottle/)
  })
})
