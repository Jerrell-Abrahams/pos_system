ALTER TABLE sales ADD COLUMN discount_authorized_by INTEGER REFERENCES employees(id);
