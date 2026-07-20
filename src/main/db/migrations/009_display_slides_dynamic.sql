-- Moves display_slides from 6 fixed, individually-enabled slots to a freeform ordered list:
-- add/remove any number of slides, "in the table" now means "shown" (enabled column dropped),
-- and slot's 1-6 CHECK constraint is gone since SQLite can't ALTER a CHECK — rebuild the table.
CREATE TABLE display_slides_new (
  id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'mostPopular' CHECK (source IN ('promotions','category','mostPopular')),
  category_id INTEGER REFERENCES categories(id),
  title TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO display_slides_new (id, position, source, category_id, title, updated_at)
  SELECT id, slot, source, category_id, title, updated_at
  FROM display_slides
  WHERE enabled = 1;

DROP TABLE display_slides;
ALTER TABLE display_slides_new RENAME TO display_slides;
