import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'pos-theme'

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

// Reads localStorage and applies the theme as soon as this module loads — main.tsx imports it
// before rendering, so there's no flash of the wrong theme on startup.
const initialTheme: Theme = localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
applyTheme(initialTheme)

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  }
}))
