import type Database from 'better-sqlite3'
import { registerAnalyticsHandlers } from './analytics'
import { registerAuditLogHandlers } from './auditLog'
import { registerAuthHandlers } from './auth'
import { registerAutoUpdateHandlers } from './autoUpdate'
import { registerCatalogHandlers } from './catalog'
import { registerCustomerDisplayHandlers } from './customerDisplay'
import { registerDashboardHandlers } from './dashboard'
import { registerDisplaySlidesHandlers } from './displaySlides'
import { registerEmployeesHandlers } from './employees'
import { registerInsightsHandlers } from './insights'
import { registerInventoryHandlers } from './inventory'
import { registerLicenseHandlers } from './license'
import { registerPrinterHandlers } from './printer'
import { registerProductsHandlers } from './products'
import { registerPromotionsHandlers } from './promotions'
import { registerSalesHandlers } from './sales'
import { registerSettingsHandlers } from './settings'
import { registerSetupHandlers } from './setup'
import { registerTillHandlers } from './till'

export function registerIpcHandlers(db: Database.Database, onDisplaySlidesUpdated?: () => void): void {
  registerAuthHandlers(db)
  registerSetupHandlers(db)
  registerAutoUpdateHandlers()
  registerLicenseHandlers(db)
  registerCatalogHandlers(db)
  registerSalesHandlers(db)
  registerSettingsHandlers(db)
  registerPrinterHandlers(db)
  registerTillHandlers(db)
  registerProductsHandlers(db)
  registerInventoryHandlers(db)
  registerDashboardHandlers(db)
  registerEmployeesHandlers(db)
  registerAnalyticsHandlers(db)
  registerPromotionsHandlers(db)
  registerInsightsHandlers(db)
  registerAuditLogHandlers(db)
  registerCustomerDisplayHandlers()
  registerDisplaySlidesHandlers(db, onDisplaySlidesUpdated)
}
