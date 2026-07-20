import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import type { DisplayProfile, DisplaySlide, DisplaySlidesUpdateInput } from '@shared/types'
import { logAudit } from '../lib/auditLog'
import { requireManager } from '../lib/requireManager'

interface ProfileRow {
  id: number
  name: string
  display_slot: number | null
  enabled: number
  slide_seconds: number
}

interface SlideRow {
  id: number
  profile_id: number
  position: number
  source: DisplaySlide['source']
  category_id: number | null
  title: string | null
}

function readProfiles(db: Database.Database): DisplayProfile[] {
  const profileRows = db
    .prepare('SELECT id, name, display_slot, enabled, slide_seconds FROM display_profiles ORDER BY id')
    .all() as ProfileRow[]
  const slideRows = db
    .prepare('SELECT id, profile_id, position, source, category_id, title FROM display_slides ORDER BY position')
    .all() as SlideRow[]

  return profileRows.map((p) => ({
    id: p.id,
    name: p.name,
    displaySlot: p.display_slot,
    enabled: p.enabled === 1,
    slideSeconds: p.slide_seconds,
    slides: slideRows
      .filter((s) => s.profile_id === p.id)
      .map((s) => ({ id: s.id, position: s.position, source: s.source, categoryId: s.category_id, title: s.title }))
  }))
}

export function registerDisplaySlidesHandlers(db: Database.Database, onUpdated?: () => void): void {
  ipcMain.handle('displaySlides:get', (): DisplayProfile[] => readProfiles(db))

  ipcMain.handle('displaySlides:update', (_event, input: DisplaySlidesUpdateInput): DisplayProfile[] => {
    requireManager(db, input.authorizedBy)

    // Two enabled profiles on the same monitor would open two fullscreen windows on it, one
    // hiding the other — reject it so the conflict surfaces at save instead of silently later.
    const usedSlots = new Set<number>()
    for (const profile of input.profiles) {
      if (!profile.name.trim()) throw new Error('Each display needs a name')
      if (profile.slideSeconds < 3 || profile.slideSeconds > 120) {
        throw new Error(`"${profile.name}": slide speed must be between 3 and 120 seconds`)
      }
      if (profile.enabled && profile.displaySlot !== null) {
        if (usedSlots.has(profile.displaySlot)) {
          throw new Error(`Two displays are assigned to monitor ${profile.displaySlot + 1}. Each monitor can host one display.`)
        }
        usedSlots.add(profile.displaySlot)
      }
      profile.slides.forEach((slide, i) => {
        if (slide.source === 'category' && slide.categoryId === null) {
          throw new Error(`"${profile.name}": slide ${i + 1} needs a category selected`)
        }
        if (slide.source === 'announcement' && !slide.title?.trim()) {
          throw new Error(`"${profile.name}": slide ${i + 1} needs announcement text`)
        }
      })
    }

    // Whole-set replace (delete-all-and-reinsert), same convention combos/combo_items already
    // use for update — simpler than diffing, and profile/slide counts are small.
    const deleteSlides = db.prepare('DELETE FROM display_slides')
    const deleteProfiles = db.prepare('DELETE FROM display_profiles')
    const insertProfile = db.prepare(
      'INSERT INTO display_profiles (name, display_slot, enabled, slide_seconds) VALUES (?, ?, ?, ?)'
    )
    const insertSlide = db.prepare(
      'INSERT INTO display_slides (profile_id, position, source, category_id, title) VALUES (?, ?, ?, ?, ?)'
    )
    const updateAll = db.transaction((): void => {
      deleteSlides.run()
      deleteProfiles.run()
      for (const profile of input.profiles) {
        const profileId = Number(
          insertProfile.run(profile.name.trim(), profile.displaySlot, profile.enabled ? 1 : 0, profile.slideSeconds)
            .lastInsertRowid
        )
        profile.slides.forEach((slide, i) => {
          insertSlide.run(profileId, i, slide.source, slide.categoryId, slide.title?.trim() || null)
        })
      }
    })
    updateAll()
    onUpdated?.()

    const after = readProfiles(db)
    logAudit(db, {
      employeeId: input.authorizedBy,
      action: 'displaySlides.update',
      entityType: 'displaySlides',
      entityId: null,
      details: {
        profiles: after.map((p) => ({ name: p.name, enabled: p.enabled, displaySlot: p.displaySlot, slideCount: p.slides.length }))
      }
    })

    return after
  })
}
