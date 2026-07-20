-- A "6-pack" is a case/multipack product that can be broken open into single units. is_6_pack
-- marks such a product; split_target_product_id names the single-unit product that receives 6
-- units when one pack is split. Both are set on the product form; the split itself runs through
-- inventory:splitPack from the inventory item modal.

ALTER TABLE products ADD COLUMN is_6_pack INTEGER NOT NULL DEFAULT 0;

-- Self-referencing FK to products(id). Default NULL is mandatory here: SQLite only allows ALTER
-- TABLE ADD COLUMN with a REFERENCES clause when the default is NULL. A configured target with
-- stock history can't be hard-deleted anyway (stock_moves FK is RESTRICT), matching how the rest
-- of the schema protects referenced products.
ALTER TABLE products ADD COLUMN split_target_product_id INTEGER REFERENCES products(id);
