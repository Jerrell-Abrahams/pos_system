-- Adds an 'announcement' source (a free-text slide whose message lives in the title column).
-- SQLite can't ALTER a CHECK constraint, so rebuild display_slides the same way 009 did — this
-- time preserving the profile_id column that 010 added.
CREATE TABLE display_slides_new (
  id INTEGER PRIMARY KEY,
  profile_id INTEGER REFERENCES display_profiles(id),
  position INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'mostPopular' CHECK (source IN ('promotions','category','mostPopular','announcement')),
  category_id INTEGER REFERENCES categories(id),
  title TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO display_slides_new (id, profile_id, position, source, category_id, title, updated_at)
  SELECT id, profile_id, position, source, category_id, title, updated_at FROM display_slides;

DROP TABLE display_slides;
ALTER TABLE display_slides_new RENAME TO display_slides;
