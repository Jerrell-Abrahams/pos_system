-- A product can legitimately carry more than one barcode: packaging changes, a second supplier,
-- or a single and a multipack that scan differently. products.barcode could only hold one, so the
-- rest were unscannable. Barcodes move to their own table, keyed by the code itself.

-- barcode as PRIMARY KEY makes a code globally unique: no two products can claim the same one, so
-- a scan always resolves to exactly one product. Reusing a code on a replacement product means
-- removing it from the old product first, which is now an explicit action in the product form.
CREATE TABLE product_barcodes (
  barcode    TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_barcodes_product ON product_barcodes(product_id);

-- OR IGNORE, not a bare INSERT: nothing has ever stopped two products sharing a barcode, and this
-- migration auto-updates every till. A duplicate would abort the transaction and leave the app
-- unable to start. Such a code was already ambiguous at the scanner (first match won), so keeping
-- the first and dropping the rest loses nothing that worked.
INSERT OR IGNORE INTO product_barcodes (barcode, product_id)
  SELECT trim(barcode), id FROM products
  WHERE barcode IS NOT NULL AND trim(barcode) != '';

-- SQLite refuses to drop a column while an index references it, so this order is required.
DROP INDEX idx_products_barcode;
ALTER TABLE products DROP COLUMN barcode;
