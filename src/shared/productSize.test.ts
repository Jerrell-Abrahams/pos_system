import { describe, expect, it } from 'vitest'
import { distinctSizes, parseSize } from './productSize'

describe('parseSize', () => {
  it('collapses case and spacing variants to one canonical label', () => {
    expect(parseSize('Coca-Cola 750ml')?.label).toBe('750ml')
    expect(parseSize('Fanta 750ML')?.label).toBe('750ml')
    expect(parseSize('Sprite 750 ml')?.label).toBe('750ml')
  })

  it('canonicalises litres as "L" and trims a trailing .0', () => {
    expect(parseSize('Water 1L')?.label).toBe('1L')
    expect(parseSize('Water 1l')?.label).toBe('1L')
    expect(parseSize('Water 1.0L')?.label).toBe('1L')
    expect(parseSize('Water 1.5L')?.label).toBe('1.5L')
    expect(parseSize('Water 2 L')?.label).toBe('2L')
  })

  it('parses grams and returns null when there is no size', () => {
    expect(parseSize('NikNaks 50g')?.label).toBe('50g')
    expect(parseSize('Russian & Chips')).toBeNull()
  })

  it('does not treat a leading "4th" as a size', () => {
    expect(parseSize('4th Street Sweet Red 750ml')?.label).toBe('750ml')
  })

  it('parses a pack count from "P" or "Pack", but not from an unrelated trailing word', () => {
    expect(parseSize('Toilet Rolls 6P')?.label).toBe('6 Pack')
    expect(parseSize('Toilet Rolls 6p')?.label).toBe('6 Pack')
    expect(parseSize('Toilet Rolls 6 Pack')?.label).toBe('6 Pack')
    expect(parseSize('Widget 6PK')).toBeNull()
  })

  it('prefers the volume/weight over a pack count when a name has both', () => {
    expect(parseSize('Amstel 6 Pack 340ml')?.label).toBe('340ml')
    expect(parseSize('Amstel 340ml 6 Pack')?.label).toBe('340ml')
  })
})

describe('distinctSizes', () => {
  it('orders volumes ascending and de-dupes across casing', () => {
    const sizes = distinctSizes(['Coke 1L', 'Coke 500ml', 'Coke 2L', 'Water 500ML'])
    expect(sizes).toEqual(['500ml', '1L', '2L'])
  })

  it('groups volumes before weights', () => {
    const sizes = distinctSizes(['Chips 50g', 'Coke 500ml', 'Coke 1L', 'Biltong 100g'])
    expect(sizes).toEqual(['500ml', '1L', '50g', '100g'])
  })
})
