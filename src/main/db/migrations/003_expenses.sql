CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  note TEXT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
