import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Category,
  DisplayProfile,
  DisplaySlide,
  DisplaySlideSource,
  SecondaryDisplayInfo
} from '@shared/types'
import { useCatalogStore } from '../../stores/catalogStore'
import { useNavStore, type Screen } from '../../stores/navStore'
import { useToastStore } from '../../stores/toastStore'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ManagerPinModal } from '../common/ManagerPinModal'
import { NumberStepperField } from '../common/NumberStepperField'
import { Select } from '../common/Select'

const SOURCE_LABEL: Record<DisplaySlideSource, string> = {
  mostPopular: 'Most Popular',
  promotions: 'Promotions',
  category: 'Category',
  announcement: 'Announcement'
}

interface SlotOption {
  value: number
  label: string
}

export function DisplayManagerScreen(): React.JSX.Element {
  const categories = useCatalogStore((s) => s.categories)
  const catalogLoaded = useCatalogStore((s) => s.loaded)
  const loadCatalog = useCatalogStore((s) => s.load)
  const pushToast = useToastStore((s) => s.push)

  const [profiles, setProfiles] = useState<DisplayProfile[] | null>(null)
  const [secondaryDisplays, setSecondaryDisplays] = useState<SecondaryDisplayInfo[]>([])
  const [previewOpen, setPreviewOpen] = useState<Set<number>>(new Set())
  const [showManagerGate, setShowManagerGate] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingNav, setPendingNav] = useState<Screen | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)
  const nextTempId = useRef(-1)

  // Mirrored into a ref so the nav blocker (registered once) always reads the live value instead
  // of a stale closure over `dirty`.
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    if (!catalogLoaded) void loadCatalog()
  }, [catalogLoaded, loadCatalog])

  useEffect(() => {
    void window.api.displaySlides.get().then(setProfiles)
    void window.api.customerDisplay.listSecondaryDisplays().then(setSecondaryDisplays)
  }, [])

  // Veto navigating away with unsaved edits; stash the target and let the confirm dialog re-issue
  // the nav once the manager accepts losing them.
  useEffect(() => {
    useNavStore.getState().setBlocker((target) => {
      if (!dirtyRef.current) return true
      setPendingNav(target)
      return false
    })
    return () => useNavStore.getState().setBlocker(null)
  }, [])

  // Currently-connected monitors, plus any slot a profile is still assigned to even if that
  // monitor isn't plugged in right now — so a temporarily-disconnected assignment stays visible
  // instead of silently vanishing from the dropdown.
  const slotOptions = useMemo<SlotOption[]>(() => {
    const options = secondaryDisplays.map((d) => ({
      value: d.index,
      label: `Display ${d.index + 1} (${d.width}×${d.height})`
    }))
    const known = new Set(options.map((o) => o.value))
    for (const p of profiles ?? []) {
      if (p.displaySlot !== null && !known.has(p.displaySlot)) {
        options.push({ value: p.displaySlot, label: `Display ${p.displaySlot + 1} (not connected)` })
        known.add(p.displaySlot)
      }
    }
    return options.sort((a, b) => a.value - b.value)
  }, [secondaryDisplays, profiles])

  // How many enabled profiles claim each monitor — >1 means a conflict to flag on the card.
  const enabledSlotUsage = useMemo(() => {
    const counts = new Map<number, number>()
    for (const p of profiles ?? []) {
      if (p.enabled && p.displaySlot !== null) counts.set(p.displaySlot, (counts.get(p.displaySlot) ?? 0) + 1)
    }
    return counts
  }, [profiles])

  function updateProfile(id: number, patch: Partial<DisplayProfile>): void {
    setProfiles((ps) => (ps ? ps.map((p) => (p.id === id ? { ...p, ...patch } : p)) : ps))
    setDirty(true)
  }

  function addProfile(): void {
    setProfiles((ps) => {
      const list = ps ?? []
      const profile: DisplayProfile = {
        id: nextTempId.current--,
        name: `Display ${list.length + 1}`,
        displaySlot: null,
        enabled: false,
        slideSeconds: 8,
        slides: []
      }
      return [...list, profile]
    })
    setDirty(true)
  }

  function removeProfile(id: number): void {
    // Close any preview window for this profile first — otherwise it lingers as an orphaned
    // "configuration removed" window that the save-time cleanup can no longer see.
    if (previewOpen.has(id)) void window.api.customerDisplay.setTestWindow(id, false)
    setProfiles((ps) => (ps ? ps.filter((p) => p.id !== id) : ps))
    setPreviewOpen((s) => {
      if (!s.has(id)) return s
      const next = new Set(s)
      next.delete(id)
      return next
    })
    setDirty(true)
  }

  async function openPreview(profileId: number): Promise<void> {
    // Preview renders saved DB state; with unsaved edits it would show something stale (and every
    // profile's id changes on save anyway), so require a clean save first.
    if (dirty) {
      pushToast('Save your changes first, then preview.', 'error')
      return
    }
    const result = await window.api.customerDisplay.setTestWindow(profileId, true)
    if (!result.ok) {
      pushToast(`Could not open preview: ${result.error}`, 'error')
      return
    }
    setPreviewOpen((s) => new Set(s).add(profileId))
  }

  async function save(authorizedBy: number): Promise<void> {
    if (!profiles) return
    setShowManagerGate(false)
    setSaving(true)
    setError('')
    try {
      // Saving reassigns every profile's id (delete-all-reinsert server-side), which would
      // orphan any open preview windows — close them first for a clean slate.
      await Promise.all([...previewOpen].map((id) => window.api.customerDisplay.setTestWindow(id, false)))
      setPreviewOpen(new Set())

      const saved = await window.api.displaySlides.update({
        profiles: profiles.map((p) => ({
          name: p.name,
          displaySlot: p.displaySlot,
          enabled: p.enabled,
          slideSeconds: p.slideSeconds,
          slides: p.slides.map(({ source, categoryId, title }) => ({ source, categoryId, title }))
        })),
        authorizedBy
      })
      setProfiles(saved)
      setDirty(false)
      pushToast('Display settings saved', 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save display settings')
    } finally {
      setSaving(false)
    }
  }

  function discardAndLeave(): void {
    const target = pendingNav
    dirtyRef.current = false
    setDirty(false)
    setPendingNav(null)
    if (target) useNavStore.getState().setScreen(target)
  }

  if (!profiles) {
    return <div className="p-4 text-sm text-ink-muted">Loading…</div>
  }

  if (showManagerGate) {
    return (
      <div className="flex h-full items-center justify-center">
        <ManagerPinModal
          title="Manager approval required"
          message="Saving display settings needs a manager PIN."
          onAuthorized={(managerId) => void save(managerId)}
          onCancel={() => setShowManagerGate(false)}
        />
      </div>
    )
  }

  const removeTarget = confirmRemoveId !== null ? profiles.find((p) => p.id === confirmRemoveId) : undefined

  return (
    <div className="flex h-full flex-col p-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4">
          {profiles.length === 0 && <p className="text-center text-sm text-ink-muted">No displays configured yet</p>}
          {profiles.map((profile, index) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              index={index}
              categories={categories}
              slotOptions={slotOptions}
              slotConflict={
                profile.enabled &&
                profile.displaySlot !== null &&
                (enabledSlotUsage.get(profile.displaySlot) ?? 0) > 1
              }
              onChange={(patch) => updateProfile(profile.id, patch)}
              onRemove={() => setConfirmRemoveId(profile.id)}
              onOpenPreview={() => void openPreview(profile.id)}
            />
          ))}
          <button
            type="button"
            onClick={addProfile}
            className="h-12 w-full rounded-xl border border-dashed border-border text-sm font-medium text-ink-muted active:bg-accent-tint"
          >
            + Add Display
          </button>

          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </div>
      </div>

      <div className="mx-auto mt-3 w-full max-w-2xl">
        <button
          type="button"
          disabled={saving}
          onClick={() => setShowManagerGate(true)}
          className="h-14 w-full rounded-xl bg-accent text-lg font-semibold text-bg active:bg-accent-light disabled:opacity-40"
        >
          {saving ? 'Saving…' : dirty ? 'Save Display Settings •' : 'Save Display Settings'}
        </button>
      </div>

      {removeTarget && (
        <ConfirmDialog
          title="Remove this display?"
          message={`"${removeTarget.name}" and its slides will be removed when you save. This can't be undone.`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeProfile(removeTarget.id)
            setConfirmRemoveId(null)
          }}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}

      {pendingNav && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You have unsaved display changes. Leaving now will discard them."
          confirmLabel="Discard"
          onConfirm={discardAndLeave}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  )
}

function ProfileCard({
  profile,
  index,
  categories,
  slotOptions,
  slotConflict,
  onChange,
  onRemove,
  onOpenPreview
}: {
  profile: DisplayProfile
  index: number
  categories: Category[]
  slotOptions: SlotOption[]
  slotConflict: boolean
  onChange: (patch: Partial<DisplayProfile>) => void
  onRemove: () => void
  onOpenPreview: () => void
}): React.JSX.Element {
  const nextTempSlideId = useRef(-1)

  function updateSlide(id: number, patch: Partial<DisplaySlide>): void {
    onChange({ slides: profile.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  }

  function moveSlide(from: number, to: number): void {
    if (to < 0 || to >= profile.slides.length) return
    const next = [...profile.slides]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange({ slides: next })
  }

  function addSlide(): void {
    onChange({
      slides: [
        ...profile.slides,
        {
          id: nextTempSlideId.current--,
          position: profile.slides.length,
          source: 'mostPopular',
          categoryId: null,
          title: null
        }
      ]
    })
  }

  function removeSlide(id: number): void {
    onChange({ slides: profile.slides.filter((s) => s.id !== id) })
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={profile.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={`Display ${index + 1}`}
          className="h-10 flex-1 rounded-xl border border-border bg-bg px-3 text-sm font-medium text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove display"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Toggle label="Enabled" checked={profile.enabled} onChange={(v) => onChange({ enabled: v })} />
        <button
          type="button"
          onClick={onOpenPreview}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-border text-sm font-medium text-ink active:bg-accent-tint"
        >
          Open preview
        </button>
      </div>

      <div>
        <label className="text-xs text-ink-muted">Monitor</label>
        <div className="mt-1">
          <Select
            value={profile.displaySlot ?? ''}
            onChange={(v) => onChange({ displaySlot: v ? Number(v) : null })}
          >
            <option value="">Unassigned</option>
            {slotOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {slotConflict ? (
          <p className="mt-1 text-xs text-danger">Another enabled display already uses this monitor.</p>
        ) : profile.enabled && profile.displaySlot === null ? (
          <p className="mt-1 text-xs text-ink-muted">Assign a monitor for this display to go live.</p>
        ) : null}
      </div>

      <NumberStepperField
        label="Seconds per slide"
        value={profile.slideSeconds}
        onChange={(v) => onChange({ slideSeconds: v })}
        min={3}
        max={120}
      />

      <div>
        <label className="text-xs text-ink-muted">Slides</label>
        <div className="mt-2 space-y-3">
          {profile.slides.length === 0 && <p className="text-sm text-ink-muted">No slides added yet</p>}
          {profile.slides.map((slide, slideIndex) => (
            <SlideRow
              key={slide.id}
              index={slideIndex}
              slide={slide}
              categories={categories}
              isFirst={slideIndex === 0}
              isLast={slideIndex === profile.slides.length - 1}
              onChange={(patch) => updateSlide(slide.id, patch)}
              onRemove={() => removeSlide(slide.id)}
              onMoveUp={() => moveSlide(slideIndex, slideIndex - 1)}
              onMoveDown={() => moveSlide(slideIndex, slideIndex + 1)}
            />
          ))}
          <button
            type="button"
            onClick={addSlide}
            className="h-10 w-full rounded-xl border border-dashed border-border text-sm font-medium text-ink-muted active:bg-accent-tint"
          >
            + Add Slide
          </button>
        </div>
      </div>
    </div>
  )
}

function SlideRow({
  slide,
  index,
  categories,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown
}: {
  slide: DisplaySlide
  index: number
  categories: Category[]
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<DisplaySlide>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Slide {index + 1}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move slide up"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move slide down"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint disabled:opacity-30"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove slide"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted active:bg-accent-tint"
          >
            ✕
          </button>
        </div>
      </div>

      <Select
        value={slide.source}
        onChange={(v) =>
          onChange({ source: v as DisplaySlideSource, categoryId: v === 'category' ? slide.categoryId : null })
        }
        surface="surface"
      >
        {(Object.keys(SOURCE_LABEL) as DisplaySlideSource[]).map((source) => (
          <option key={source} value={source}>
            {SOURCE_LABEL[source]}
          </option>
        ))}
      </Select>

      {slide.source === 'category' && (
        <Select
          value={slide.categoryId ?? ''}
          onChange={(v) => onChange({ categoryId: v ? Number(v) : null })}
          surface="surface"
        >
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}

      <input
        type="text"
        value={slide.title ?? ''}
        onChange={(e) => onChange({ title: e.target.value || null })}
        placeholder={
          slide.source === 'announcement' ? 'Announcement text (e.g. Happy Hour 5–7pm)' : autoTitle(slide, categories)
        }
        className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent-border focus:outline-none"
      />
    </div>
  )
}

// Falls back to this same label on the customer-display screen when the manager leaves the
// title blank, so the placeholder here always previews exactly what will actually show.
function autoTitle(slide: DisplaySlide, categories: Category[]): string {
  if (slide.source === 'promotions') return 'Promotions'
  if (slide.source === 'mostPopular') return 'Most Popular'
  return categories.find((c) => c.id === slide.categoryId)?.name ?? 'Category'
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex h-12 w-full items-center justify-between rounded-xl border px-3 text-sm font-medium ${
        checked ? 'border-accent-border bg-accent-tint text-accent-light' : 'border-border text-ink-muted'
      }`}
    >
      <span>{label}</span>
      <span>{checked ? 'On' : 'Off'}</span>
    </button>
  )
}
