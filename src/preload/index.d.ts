import type { PosApi } from '@shared/types'

declare global {
  interface Window {
    api: PosApi
  }
  const __APP_VERSION__: string
}
