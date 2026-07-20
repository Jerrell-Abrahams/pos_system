import { ipcMain } from 'electron'
import type { SecondaryDisplayInfo, TestActionResult } from '@shared/types'
import { closePreviewWindow, openPreviewWindow, secondaryDisplays } from '../lib/customerDisplay'

export function registerCustomerDisplayHandlers(): void {
  ipcMain.handle('customerDisplay:setTestWindow', (_event, profileId: number, open: boolean): TestActionResult => {
    try {
      if (open) openPreviewWindow(profileId)
      else closePreviewWindow(profileId)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not update preview window' }
    }
  })

  ipcMain.handle(
    'customerDisplay:listSecondaryDisplays',
    (): SecondaryDisplayInfo[] =>
      secondaryDisplays().map((d, index) => ({ index, width: d.bounds.width, height: d.bounds.height }))
  )
}
