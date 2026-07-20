import { BrowserWindow, screen } from 'electron'
import type { Display } from 'electron'
import { join } from 'path'

export interface ProfileTarget {
  id: number
  enabled: boolean
  displaySlot: number | null
}

// One live (kiosk, monitor-bound) window per enabled+assigned profile, keyed by profile id.
const liveWindows = new Map<number, BrowserWindow>()
// One preview (windowed, manual) window per profile a manager has toggled on, also by id.
const previewWindows = new Map<number, BrowserWindow>()
let lastProfiles: ProfileTarget[] = []
let listenersBound = false

// Pure and exported separately from secondaryDisplays() so it stays unit-testable without a
// real Electron `screen` — see customerDisplay.test.ts.
export function secondaryDisplaysOf(displays: Display[], primaryId: number): Display[] {
  return displays.filter((d) => d.id !== primaryId)
}

export function secondaryDisplays(): Display[] {
  return secondaryDisplaysOf(screen.getAllDisplays(), screen.getPrimaryDisplay().id)
}

function loadCustomerDisplayRoute(win: BrowserWindow, profileId: number): void {
  const hash = `customer-display?profile=${profileId}`
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function createLiveWindow(target: Display, profileId: number): BrowserWindow {
  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('closed', () => {
    if (liveWindows.get(profileId) === win) liveWindows.delete(profileId)
  })

  loadCustomerDisplayRoute(win, profileId)
  return win
}

// Re-evaluates every profile against currently-connected monitors: opens/repositions a kiosk
// window for each enabled profile whose displaySlot matches a connected non-primary monitor,
// and closes windows for profiles that are now disabled, unassigned, deleted, or whose monitor
// got unplugged. Called on every display-config save and whenever monitors are plugged/unplugged.
export function syncDisplayProfiles(profiles: ProfileTarget[]): void {
  lastProfiles = profiles

  if (!listenersBound) {
    listenersBound = true
    screen.on('display-added', () => syncDisplayProfiles(lastProfiles))
    screen.on('display-removed', () => syncDisplayProfiles(lastProfiles))
  }

  const secondaries = secondaryDisplays()
  const wanted = new Set<number>()

  for (const profile of profiles) {
    const target = profile.enabled && profile.displaySlot !== null ? secondaries[profile.displaySlot] : undefined
    if (!target) continue
    wanted.add(profile.id)

    const existing = liveWindows.get(profile.id)
    if (existing) {
      existing.setBounds(target.bounds)
    } else {
      liveWindows.set(profile.id, createLiveWindow(target, profile.id))
    }
  }

  for (const [profileId, win] of liveWindows) {
    if (!wanted.has(profileId)) win.close()
  }
}

// Windowed (not fullscreen, not tied to a monitor) so a profile's content can be checked on a
// single-screen dev machine, or before a real monitor is plugged into that profile's slot.
export function openPreviewWindow(profileId: number): void {
  const existing = previewWindows.get(profileId)
  if (existing) {
    existing.focus()
    return
  }
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    title: 'Customer Display Preview',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('closed', () => {
    if (previewWindows.get(profileId) === win) previewWindows.delete(profileId)
  })

  loadCustomerDisplayRoute(win, profileId)
  previewWindows.set(profileId, win)
}

export function closePreviewWindow(profileId: number): void {
  previewWindows.get(profileId)?.close()
}
