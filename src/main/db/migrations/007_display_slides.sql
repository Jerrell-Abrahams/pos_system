CREATE TABLE display_slides (
  id INTEGER PRIMARY KEY,
  slot INTEGER NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 6),
  enabled INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'mostPopular' CHECK (source IN ('promotions','category','mostPopular')),
  category_id INTEGER REFERENCES categories(id),
  updated_at TEXT DEFAULT (datetime('now'))
);
