CREATE TABLE combos (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE combo_items (
  id INTEGER PRIMARY KEY,
  combo_id INTEGER NOT NULL REFERENCES combos(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty REAL NOT NULL
);

ALTER TABLE sales ADD COLUMN combo_discount_cents INTEGER NOT NULL DEFAULT 0;
