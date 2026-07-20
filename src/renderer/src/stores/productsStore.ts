import { create } from 'zustand'
import type { Category, ProductDetail } from '@shared/types'

interface ProductsState {
  categories: Category[]
  products: ProductDetail[]
  loaded: boolean
  load: () => Promise<void>
}

export const useProductsStore = create<ProductsState>((set) => ({
  categories: [],
  products: [],
  loaded: false,
  load: async () => {
    const { categories, products } = await window.api.products.list()
    set({ categories, products, loaded: true })
  }
}))
