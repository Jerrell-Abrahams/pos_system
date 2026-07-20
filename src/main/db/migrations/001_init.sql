CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  sell_price_cents INTEGER NOT NULL,
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL DEFAULT 5,
  barcode TEXT,
  image_path TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('cashier','manager')),
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tills (
  id INTEGER PRIMARY KEY,
  till_device_id TEXT NOT NULL,
  opened_by INTEGER REFERENCES employees(id),
  opened_at TEXT NOT NULL,
  opening_cash_cents INTEGER NOT NULL,
  closed_by INTEGER REFERENCES employees(id),
  closed_at TEXT,
  closing_cash_cents INTEGER,
  expected_cash_cents INTEGER,
  cash_difference_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  till_id INTEGER NOT NULL REFERENCES tills(id),
  till_device_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  vat_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed','voided','refunded')),
  voided_by INTEGER REFERENCES employees(id),
  void_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('cash','card','eft')),
  amount_cents INTEGER NOT NULL,
  tendered_cents INTEGER,
  change_cents INTEGER
);

CREATE TABLE stock_moves (
  id INTEGER PRIMARY KEY,
  till_device_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('in','out','adjustment','sale','refund')),
  qty REAL NOT NULL,
  reason TEXT,
  employee_id INTEGER REFERENCES employees(id),
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sync_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
