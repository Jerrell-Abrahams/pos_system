import m001 from './001_init.sql?raw'
import m002 from './002_discount_auth.sql?raw'
import m003 from './003_expenses.sql?raw'
import m004 from './004_combos.sql?raw'
import m005 from './005_insight_indexes.sql?raw'
import m006 from './006_audit_log.sql?raw'
import m007 from './007_display_slides.sql?raw'
import m008 from './008_display_slide_titles.sql?raw'
import m009 from './009_display_slides_dynamic.sql?raw'
import m010 from './010_display_profiles.sql?raw'
import m011 from './011_display_slide_announcement.sql?raw'
import m012 from './012_product_barcodes.sql?raw'
import m013 from './013_payment_terminal.sql?raw'
import m014 from './014_split_pack.sql?raw'
import m016 from './016_combo_categories.sql?raw'

export interface Migration {
  version: number
  name: string
  sql: string
}

export const migrations: Migration[] = [
  { version: 1, name: '001_init', sql: m001 },
  { version: 2, name: '002_discount_auth', sql: m002 },
  { version: 3, name: '003_expenses', sql: m003 },
  { version: 4, name: '004_combos', sql: m004 },
  { version: 5, name: '005_insight_indexes', sql: m005 },
  { version: 6, name: '006_audit_log', sql: m006 },
  { version: 7, name: '007_display_slides', sql: m007 },
  { version: 8, name: '008_display_slide_titles', sql: m008 },
  { version: 9, name: '009_display_slides_dynamic', sql: m009 },
  { version: 10, name: '010_display_profiles', sql: m010 },
  { version: 11, name: '011_display_slide_announcement', sql: m011 },
  { version: 12, name: '012_product_barcodes', sql: m012 },
  { version: 13, name: '013_payment_terminal', sql: m013 },
  { version: 14, name: '014_split_pack', sql: m014 },
  { version: 16, name: '016_combo_categories', sql: m016 }
]
// Next migration: add 017_xxx.sql next to this file and push one more entry here.
// (Version 15 was intentionally skipped — a reverted attempt already burned that number on some DBs.)
