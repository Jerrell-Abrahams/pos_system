CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at);
