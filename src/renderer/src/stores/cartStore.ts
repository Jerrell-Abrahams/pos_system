import { create } from 'zustand'
import type { Combo, Product } from '@shared/types'

export interface CartLine {
  productId: number
  name: string
  unitPriceCents: number
  qty: number
}

export interface ComboLine {
  comboId: number
  name: string
  priceCents: number
  // Component value for one application of the combo, at the prices when it was added —
  // used to show the promo's savings without re-fetching current prices per render.
  componentsCentsPerUnit: number
  qty: number
  items: { productId: number; qty: number }[]
}

export interface CartDiscount {
  type: 'fixed' | 'percent'
  value: number
  authorizedBy: number | null
}

interface CartState {
  lines: CartLine[]
  comboLines: ComboLine[]
  discount: CartDiscount | null
  addProduct: (product: Product) => void
  setQty: (productId: number, qty: number) => void
  removeLine: (productId: number) => void
  addCombo: (combo: Combo) => void
  setComboQty: (comboId: number, qty: number) => void
  removeCombo: (comboId: number) => void
  setDiscount: (discount: CartDiscount | null) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  comboLines: [],
  discount: null,
  addProduct: (product) =>
    set((state) => {
      const existing = state.lines.find((l) => l.productId === product.id)
      if (existing) {
        return { lines: state.lines.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l)) }
      }
      return {
        lines: [
          ...state.lines,
          { productId: product.id, name: product.name, unitPriceCents: product.sellPriceCents, qty: 1 }
        ]
      }
    }),
  setQty: (productId, qty) =>
    set((state) => ({
      lines:
        qty <= 0
          ? state.lines.filter((l) => l.productId !== productId)
          : state.lines.map((l) => (l.productId === productId ? { ...l, qty } : l))
    })),
  removeLine: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
  addCombo: (combo) =>
    set((state) => {
      const existing = state.comboLines.find((c) => c.comboId === combo.id)
      if (existing) {
        return {
          comboLines: state.comboLines.map((c) => (c.comboId === combo.id ? { ...c, qty: c.qty + 1 } : c))
        }
      }
      return {
        comboLines: [
          ...state.comboLines,
          {
            comboId: combo.id,
            name: combo.name,
            priceCents: combo.priceCents,
            componentsCentsPerUnit: combo.componentsCents,
            qty: 1,
            items: combo.items.map((i) => ({ productId: i.productId, qty: i.qty }))
          }
        ]
      }
    }),
  setComboQty: (comboId, qty) =>
    set((state) => ({
      comboLines:
        qty <= 0
          ? state.comboLines.filter((c) => c.comboId !== comboId)
          : state.comboLines.map((c) => (c.comboId === comboId ? { ...c, qty } : c))
    })),
  removeCombo: (comboId) => set((state) => ({ comboLines: state.comboLines.filter((c) => c.comboId !== comboId) })),
  setDiscount: (discount) => set({ discount }),
  clear: () => set({ lines: [], comboLines: [], discount: null })
}))

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0)
}

export function cartComboComponentsCents(comboLines: ComboLine[]): number {
  return comboLines.reduce((sum, c) => sum + c.componentsCentsPerUnit * c.qty, 0)
}

// Not clamped to >= 0: if a combo's set price is actually higher than its parts' combined
// price (a premium bundle, or just an unusual price choice), this goes negative — which,
// added back in the total (see CartPanel), still charges exactly the combo's set price rather
// than silently falling back to the cheaper "bought separately" total.
export function cartComboDiscountCents(comboLines: ComboLine[]): number {
  return comboLines.reduce((sum, c) => sum + (c.componentsCentsPerUnit - c.priceCents) * c.qty, 0)
}

export function cartComboItemsAsSaleItems(comboLines: ComboLine[]): { productId: number; qty: number }[] {
  return comboLines.flatMap((c) => c.items.map((i) => ({ productId: i.productId, qty: i.qty * c.qty })))
}
