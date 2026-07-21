// Product sizes live inside the name ("Coca-Cola 500ml", "Klipdrift 1L", "Toilet Rolls 6P") rather
// than a dedicated column, so we parse them for the POS size filter. Tolerant of case and spacing,
// so "750ml", "750ML" and "750 ml" all collapse to the one canonical chip "750ml"; "6P" and
// "6 Pack" both collapse to "6 Pack".

interface Unit {
  base: number // multiplier into the family's base unit (ml for volume, g for weight, 1 for packs)
  family: number // 0 = volume, 1 = weight, 2 = pack count — keeps them from interleaving when sorted
  label: string // canonical casing
  spaced?: boolean // "6 Pack" reads better with a space; "750ml" doesn't want one
}

const PACK_UNIT: Unit = { base: 1, family: 2, label: 'Pack', spaced: true }

const UNITS: Record<string, Unit> = {
  ml: { base: 1, family: 0, label: 'ml' },
  cl: { base: 10, family: 0, label: 'cl' },
  l: { base: 1000, family: 0, label: 'L' },
  g: { base: 1, family: 1, label: 'g' },
  kg: { base: 1000, family: 1, label: 'kg' },
  pack: PACK_UNIT,
  p: PACK_UNIT
}

// Two-char units (ml/cl/kg) listed before the one-char ones (l/g) so they win at the same spot.
// \b after the unit stops "1L" also matching the "l" inside a following word.
const MEASURE_RE = /(\d+(?:[.,]\d+)?)\s*(ml|cl|kg|l|g)\b/i
// Checked only when there's no measure in the name -- a name with both (e.g. "Amstel 6 Pack
// 340ml") should still chip under its volume, not whichever token happens to come first.
const PACK_RE = /(\d+(?:[.,]\d+)?)\s*(pack|p)\b/i

export interface ProductSize {
  label: string // canonical, e.g. "750ml", "1L"
  sortKey: number // orders chips: by unit family, then real magnitude
}

export function parseSize(name: string): ProductSize | null {
  const match = MEASURE_RE.exec(name) ?? PACK_RE.exec(name)
  if (!match) return null
  const amount = parseFloat(match[1].replace(',', '.'))
  const unit = UNITS[match[2].toLowerCase()]
  if (!unit || !Number.isFinite(amount)) return null
  return {
    // String(1.0) === "1", so "1.0L" reads as "1L"; "1.5L" stays. "6P"/"6 Pack" both read "6 Pack".
    label: unit.spaced ? `${amount} ${unit.label}` : `${amount}${unit.label}`,
    sortKey: unit.family * 1e9 + amount * unit.base
  }
}

// Distinct sizes across the given product names, ordered for a chip row: volumes then weights,
// each ascending. De-duped by canonical label, so casing/spacing variants merge into one chip.
export function distinctSizes(names: string[]): string[] {
  const byLabel = new Map<string, number>()
  for (const name of names) {
    const size = parseSize(name)
    if (size && !byLabel.has(size.label)) byLabel.set(size.label, size.sortKey)
  }
  return [...byLabel.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label)
}
