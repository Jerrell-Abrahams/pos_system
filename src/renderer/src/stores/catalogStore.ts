import { create } from 'zustand'
import type { Category, Product } from '@shared/types'

interface CatalogState {
  categories: Category[]
  products: Product[]
  loaded: boolean
  load: () => Promise<void>
}

export const useCatalogStore = create<CatalogState>((set) => ({
  categories: [],
  products: [],
  loaded: false,
  load: async () => {
    const { categories, products } = await window.api.catalog.list()
    set({ categories, products, loaded: true })
  }
}))
