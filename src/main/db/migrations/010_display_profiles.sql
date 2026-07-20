-- Splits the single global customer-display config into multiple named "profiles," each
-- bound to a monitor by position (display_slot = index among currently-connected non-primary
-- monitors) so one till can drive a different rotation of slides on each attached screen.
CREATE TABLE display_profiles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Display',
  display_slot INTEGER,
  enabled INTEGER NOT NULL DEFAULT 0,
  slide_seconds INTEGER NOT NULL DEFAULT 8,
  updated_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE display_slides ADD COLUMN profile_id INTEGER REFERENCES display_profiles(id);

-- Carry forward an existing install's global config (settings keys + slide rows) into one
-- profile on slot 0, matching its old single-window behavior. No-ops on a fresh install
-- (display_slides is empty at migration time, before seed.ts has run) — seed.ts creates the
-- default profile for that case instead.
INSERT INTO display_profiles (name, display_slot, enabled, slide_seconds)
  SELECT 'Display 1', 0,
    COALESCE((SELECT value FROM settings WHERE key = 'customer_display_enabled'), 'false') = 'true',
    CAST(COALESCE((SELECT value FROM settings WHERE key = 'customer_display_slide_seconds'), '8') AS INTEGER)
  WHERE EXISTS (SELECT 1 FROM display_slides);

UPDATE display_slides SET profile_id = (SELECT id FROM display_profiles ORDER BY id LIMIT 1)
  WHERE EXISTS (SELECT 1 FROM display_profiles);
