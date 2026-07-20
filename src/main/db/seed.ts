import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'

// Same dev signal main/index.ts and license.ts already key off: only `electron-vite dev` sets it,
// so it is false for packaged installers and for vitest. Demo data must never reach a real till —
// it would boot with a publicly-known manager PIN and another shop's catalog and trading name.
const IS_DEV = Boolean(process.env['ELECTRON_RENDERER_URL'])

const DEMO_CATEGORIES = ['Beers', 'Ciders & RTDs', 'Spirits', 'Wine', 'Soft Drinks & Water', 'Snacks']

// [name, categoryIndex, sellPriceCents, costPriceCents, stockQty]
//
// Deliberately no barcodes. A real EAN can only come off a real bottle via the scanner — inventing
// one risks squatting a number that belongs to an actual product, and `product_barcodes.barcode` is
// a PRIMARY KEY, so a phantom would block the genuine code from ever being registered. Scan each
// bottle into the product form instead; that is the only source of truth for a barcode.
const DEMO_PRODUCTS: [string, number, number, number, number][] = [
  ['Castle Lager 340ml', 0, 2800, 1700, 96],
  ['Castle Lite 340ml', 0, 2900, 1750, 96],
  ['Castle Milk Stout 340ml', 0, 2900, 1750, 48],
  ['Carling Black Label 340ml', 0, 2700, 1650, 96],
  ['Black Label Quart 750ml', 0, 3600, 2200, 48],
  ['Hansa Pilsener 340ml', 0, 2600, 1600, 72],
  ['Amstel Lager 330ml', 0, 3000, 1850, 72],
  ['Heineken 330ml', 0, 3400, 2100, 48],
  ['Windhoek Lager 330ml', 0, 3200, 1950, 48],
  ['Windhoek Draught 440ml', 0, 3800, 2350, 36],
  ['Flying Fish Pressed Lemon 340ml', 0, 2800, 1700, 48],

  ['Savanna Dry 330ml', 1, 3200, 2000, 60],
  ['Savanna Light 330ml', 1, 3200, 2000, 36],
  ["Hunter's Dry 330ml", 1, 3200, 2000, 60],
  ["Hunter's Gold 330ml", 1, 3200, 2000, 48],
  ['Brutal Fruit Ruby Apple 275ml', 1, 3000, 1850, 48],
  ['Bernini Blush 275ml', 1, 3000, 1850, 36],
  ['Smirnoff Spin 300ml', 1, 3300, 2050, 48],
  ['Smirnoff Storm 300ml', 1, 3300, 2050, 36],
  ['Esprit Grand Cru 275ml', 1, 3000, 1850, 24],

  // Tots are poured from a bottle, so the unit received (a 750ml bottle) is not the unit sold.
  // Scanning a delivered bottle here would count +1 when it is really ~30 tots — use the keypad.
  ['Klipdrift Brandy Tot 25ml', 2, 2500, 1400, 200],
  ['Klipdrift Premium Tot 25ml', 2, 3000, 1700, 120],
  ['Richelieu Brandy Tot 25ml', 2, 2600, 1450, 160],
  ['Viceroy Brandy Tot 25ml', 2, 2400, 1350, 120],
  ["Jack Daniel's Tot 25ml", 2, 3500, 2000, 150],
  ['Smirnoff Vodka Tot 25ml', 2, 2200, 1200, 200],
  ["Gordon's Gin Tot 25ml", 2, 2400, 1350, 120],
  ['Captain Morgan Spiced Tot 25ml', 2, 2600, 1450, 120],
  ['Bells Whisky Tot 25ml', 2, 2600, 1450, 140],
  ['J&B Rare Tot 25ml', 2, 2800, 1550, 100],
  ['Old Brown Sherry 750ml', 2, 9500, 6500, 24],
  ['Klipdrift & Coke Can 300ml', 2, 3500, 2200, 48],

  ['Tassenberg Red 750ml', 3, 8500, 5800, 24],
  ['4th Street Sweet Red 750ml', 3, 9000, 6200, 36],
  ['4th Street Natural Sweet White 750ml', 3, 9000, 6200, 36],
  ['Overmeer Late Harvest 750ml', 3, 8000, 5500, 24],
  ['Autumn Harvest Crackling 750ml', 3, 7500, 5200, 24],
  ['Nederburg Baronne 750ml', 3, 14500, 10500, 12],

  ['Coca-Cola 300ml', 4, 1800, 1000, 96],
  ['Coca-Cola 500ml', 4, 2200, 1300, 72],
  ['Sprite 300ml', 4, 1800, 1000, 72],
  ['Fanta Orange 300ml', 4, 1800, 1000, 72],
  ['Stoney Ginger Beer 300ml', 4, 1800, 1000, 48],
  ['Iron Brew 300ml', 4, 1800, 1000, 48],
  ['Tonic Water 200ml', 4, 1600, 900, 48],
  ['Still Water 500ml', 4, 1500, 800, 96],

  ['NikNaks 50g', 5, 1500, 900, 60],
  ['Simba Chips 36g', 5, 1500, 900, 60],
  ["Lay's 36g", 5, 1500, 900, 48],
  ['Doritos 45g', 5, 2000, 1200, 36],
  ['Fritos 40g', 5, 1500, 900, 36],
  ['Biltong 50g', 5, 3500, 2200, 24],
  ['Russian & Chips', 5, 4500, 2800, 30]
]

const DEMO_EMPLOYEES: [string, string, 'manager' | 'cashier'][] = [
  ['Thabo Nkosi', '1234', 'manager'],
  ['Lindiwe Dube', '5678', 'cashier']
]

// Shop identity is demo data too — a real install collects it in first-run setup, and anything
// left unset simply reads as '' (receipts omit a blank address/footer).
const DEMO_SETTINGS: [string, string][] = [
  ['business_name', 'The Thirsty Springbok'],
  ['business_address', '12 Voortrekker Road, Paarl, Western Cape'],
  ['business_number', '2019/123456/07'],
  ['receipt_footer', 'Thank you for your visit — drink responsibly.']
]

// Genuine defaults — correct on any install, demo or real.
const DEFAULT_SETTINGS: [string, string][] = [
  ['vat_enabled', 'true'],
  ['vat_rate', '15'],
  ['vat_number', ''],
  ['auto_lock_seconds', '90'],
  ['discount_threshold_percent', '20'],
  ['insight_cash_variance_threshold_cents', '5000'],
  ['printer_interface', '']
]

// [position, source] — a working default rotation (Promotions + Most Popular) on the first
// display profile, so a fresh install shows something without the manager configuring anything.
const DISPLAY_SLIDES: [number, string][] = [
  [0, 'promotions'],
  [1, 'mostPopular']
]

function seedDemoData(db: Database.Database): void {
  const alreadySeeded = (db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number }).n > 0
  if (alreadySeeded) return

  const insertCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
  const categoryIds = DEMO_CATEGORIES.map((name, i) => Number(insertCategory.run(name, i).lastInsertRowid))

  const insertProduct = db.prepare(
    `INSERT INTO products (name, category_id, sell_price_cents, cost_price_cents, stock_qty)
     VALUES (?, ?, ?, ?, ?)`
  )
  for (const [name, categoryIndex, sellPrice, costPrice, stockQty] of DEMO_PRODUCTS) {
    insertProduct.run(name, categoryIds[categoryIndex], sellPrice, costPrice, stockQty)
  }

  const insertEmployee = db.prepare('INSERT INTO employees (name, pin_hash, role) VALUES (?, ?, ?)')
  for (const [name, pin, role] of DEMO_EMPLOYEES) {
    insertEmployee.run(name, bcrypt.hashSync(pin, 10), role)
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of DEMO_SETTINGS) {
    insertSetting.run(key, value)
  }
}

// `demo` defaults to the dev signal; tests pass it explicitly. A packaged build seeds no
// employees at all, which is what routes a real install into first-run setup (see ipc/setup.ts).
export function seed(db: Database.Database, demo: boolean = IS_DEV): void {
  db.transaction(() => {
    // Settings are seeded per-key (not gated on a fresh install) so new default keys introduced
    // in later app updates still get created without wiping/overwriting an existing install.
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    for (const [key, value] of DEFAULT_SETTINGS) {
      insertSetting.run(key, value)
    }

    if (demo) seedDemoData(db)

    // Unlike settings/categories/products, display profiles are manager-editable (add/remove),
    // so there's no stable key to "INSERT OR IGNORE" per-row — only seed a default profile on
    // an install that's never had one (fresh install; migration 010 handles carrying forward
    // an existing install's config into a profile instead).
    const profilesSeeded = (db.prepare('SELECT COUNT(*) AS n FROM display_profiles').get() as { n: number }).n > 0
    if (!profilesSeeded) {
      const profileId = Number(
        db
          .prepare('INSERT INTO display_profiles (name, display_slot, enabled, slide_seconds) VALUES (?, ?, ?, ?)')
          .run('Display 1', 0, 0, 8).lastInsertRowid
      )
      const insertSlide = db.prepare('INSERT INTO display_slides (profile_id, position, source) VALUES (?, ?, ?)')
      for (const [position, source] of DISPLAY_SLIDES) {
        insertSlide.run(profileId, position, source)
      }
    }
  })()
}
