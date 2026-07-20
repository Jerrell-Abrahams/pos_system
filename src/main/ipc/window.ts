import { ipcMain, type BrowserWindow } from 'electron'

export function registerWindowHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('window:toggleFullscreen', (): void => {
    const win = getWindow()
    win?.setFullScreen(!win.isFullScreen())
  })
}
