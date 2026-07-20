export type LicenseReason =
  | 'not_activated'
  | 'pending'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'revoked'
  | 'verification_required'
  | 'clock_rollback'

export interface LicenseState {
  entitled: boolean
  reason: LicenseReason | null
  periodEnd: string | null
}

// After periodEnd passes, the license stays entitled for this many more days (grace)
// before actually locking the app. The renderer starts warning this many days ahead of
// periodEnd. Shared so main (enforcement) and renderer (banner copy) can't drift apart.
export const LICENSE_EXPIRY_WARNING_DAYS = 7
export const LICENSE_EXPIRY_GRACE_DAYS = 3

export interface LicenseActivateInput {
  email: string
  password: string
  deviceName?: string
}

export interface SetupStatus {
  needsSetup: boolean
}

export interface FirstManagerInput {
  businessName: string
  managerName: string
  pin: string
}

export type EmployeeRole = 'cashier' | 'manager'

// The super user has no employees row — deliberately, so it can't be found, renamed, or
// deleted from the Employees tab. A negative id can never collide with a real one (SQLite
// hands out positive rowids), and every foreign key to employees(id) rejects it, which is
// what stops the super user ringing a sale or opening a till: the database refuses the
// write even if a code path forgets to ask. See main/lib/superUser.ts.
//
// Lives here rather than beside the rest of the super user code so that auditLog and
// requireManager can recognise it without importing the licence subsystem (and, through
// it, electron) just to compare two numbers.
export const SUPER_USER_ID = -1

export interface EmployeeSession {
  id: number
  name: string
  role: EmployeeRole
  // Set only for the super user. See SUPER_USER_ID above.
  isSuper?: boolean
}

export interface LoginResult {
  ok: boolean
  employee?: EmployeeSession
  error?: string
}

export interface EmployeeListItem {
  id: number
  name: string
  role: EmployeeRole
  active: boolean
}

export interface EmployeeCreateInput {
  name: string
  pin: string
  role: EmployeeRole
  authorizedBy: number
}

export interface EmployeeUpdateInput {
  id: number
  name: string
  role: EmployeeRole
  active: boolean
  pin?: string
  authorizedBy: number
}

export interface Category {
  id: number
  name: string
  sortOrder: number
}

export interface Product {
  id: number
  name: string
  categoryId: number | null
  sellPriceCents: number
  stockQty: number
  barcodes: string[]
}

export interface CatalogPayload {
  categories: Category[]
  products: Product[]
}

export interface SettingsPayload {
  businessName: string
  businessAddress: string
  businessNumber: string
  vatEnabled: boolean
  vatRatePercent: number
  vatNumber: string
  autoLockSeconds: number
  discountThresholdPercent: number
  cashVarianceThresholdCents: number
  receiptFooter: string
  printerInterface: string
  backupFolder: string
  /** Card machines the cashier picks between at payment. Empty = no picker, card behaves as before. */
  cardTerminals: string[]
}

export interface SettingsUpdateInput extends SettingsPayload {
  authorizedBy: number
}

export interface CreateSaleItemInput {
  productId: number
  qty: number
}

export type PaymentMethod = 'cash' | 'card' | 'eft'

export interface PaymentInput {
  method: PaymentMethod
  amountCents: number
  tenderedCents?: number
  changeCents?: number
  /** Which card machine took it, from settings.cardTerminals. Card only; absent if none configured. */
  terminal?: string
}

export interface DiscountInput {
  amountCents: number
  authorizedBy: number | null
}

export interface ComboApplication {
  comboId: number
  qty: number
}

export interface CreateSaleInput {
  employeeId: number
  items: CreateSaleItemInput[]
  payments: PaymentInput[]
  discount?: DiscountInput
  combos?: ComboApplication[]
}

export interface CreateSaleResult {
  saleId: number
  receiptNo: string
  totalCents: number
  vatCents: number
  changeCents: number
}

export type SaleStatus = 'completed' | 'voided' | 'refunded'

export interface SaleListItem {
  id: number
  receiptNo: string
  createdAt: string
  cashierName: string
  totalCents: number
  status: SaleStatus
}

export interface SaleDetailItem {
  productName: string
  qty: number
  unitPriceCents: number
  lineTotalCents: number
}

export interface SaleDetailPayment {
  method: PaymentMethod
  amountCents: number
  tenderedCents: number | null
  changeCents: number | null
  terminal: string | null
}

export interface SaleDetail {
  id: number
  receiptNo: string
  createdAt: string
  cashierName: string
  status: SaleStatus
  voidReason: string | null
  items: SaleDetailItem[]
  payments: SaleDetailPayment[]
  subtotalCents: number
  discountCents: number
  comboDiscountCents: number
  vatCents: number
  totalCents: number
}

export interface VoidSaleInput {
  saleId: number
  authorizedBy: number
  reason: string
}

export interface DashboardPaymentBreakdown {
  method: PaymentMethod
  amountCents: number
}

export interface DailySalesPoint {
  date: string
  totalCents: number
}

export interface EmployeePerformancePoint {
  employeeId: number
  employeeName: string
  salesCount: number
  totalCents: number
}

export interface DashboardSummary {
  date: string
  salesCount: number
  totalCents: number
  vatCents: number
  paymentBreakdown: DashboardPaymentBreakdown[]
  voidedCount: number
  lowStockCount: number
  till: OpenTillInfo | null
}

export interface PrintIssueEvent {
  kind: 'print-failed'
  message: string
}

export interface TestActionResult {
  ok: boolean
  error?: string
}

export interface ProductDetail {
  id: number
  name: string
  categoryId: number | null
  sellPriceCents: number
  costPriceCents: number
  stockQty: number
  lowStockThreshold: number
  barcodes: string[]
  active: boolean
}

export interface ProductsPayload {
  categories: Category[]
  products: ProductDetail[]
}

export interface ProductCreateInput {
  name: string
  categoryId: number | null
  sellPriceCents: number
  costPriceCents: number
  stockQty: number
  lowStockThreshold: number
  barcodes: string[]
  authorizedBy: number
}

export interface ProductUpdateInput {
  id: number
  name: string
  categoryId: number | null
  sellPriceCents: number
  costPriceCents: number
  lowStockThreshold: number
  barcodes: string[]
  active: boolean
  authorizedBy: number
}

export interface ProductDeleteInput {
  id: number
  authorizedBy: number
}

export interface StockAdjustInput {
  productId: number
  authorizedBy: number
  deltaQty: number
  reason: string
}

export interface StockAdjustResult {
  productId: number
  newStockQty: number
}

export interface OpenTillInfo {
  id: number
  tillDeviceId: string
  openedAt: string
  openingCashCents: number
  expectedCashCents: number
}

export interface TillStatus {
  till: OpenTillInfo | null
}

export interface TillCloseResult {
  id: number
  expectedCashCents: number
  closingCashCents: number
  differenceCents: number
}

export interface ComboItemInput {
  productId: number
  qty: number
}

export interface ComboItem {
  productId: number
  productName: string
  qty: number
}

export interface Combo {
  id: number
  name: string
  priceCents: number
  active: boolean
  items: ComboItem[]
  // Sum of each item's current sell price * qty — what the bundle would cost bought separately.
  componentsCents: number
}

export interface ComboCreateInput {
  name: string
  priceCents: number
  items: ComboItemInput[]
  authorizedBy: number
}

export interface ComboUpdateInput {
  id: number
  name: string
  priceCents: number
  items: ComboItemInput[]
  active: boolean
  authorizedBy: number
}

// 'announcement' is a free-text slide: its `title` holds the message shown large and centered,
// not a heading over a product grid like the other (data-driven) sources.
export type DisplaySlideSource = 'promotions' | 'category' | 'mostPopular' | 'announcement'

export interface DisplaySlide {
  id: number
  position: number
  source: DisplaySlideSource
  categoryId: number | null
  title: string | null
}

export interface DisplaySlideInput {
  source: DisplaySlideSource
  categoryId: number | null
  title: string | null
}

// displaySlot is a position among currently-connected non-primary monitors (0 = first), not a
// persistent monitor identity — unplugging/replugging in a different order can shift it.
export interface DisplayProfile {
  id: number
  name: string
  displaySlot: number | null
  enabled: boolean
  slideSeconds: number
  slides: DisplaySlide[]
}

export interface DisplayProfileInput {
  name: string
  displaySlot: number | null
  enabled: boolean
  slideSeconds: number
  slides: DisplaySlideInput[]
}

export interface DisplaySlidesUpdateInput {
  profiles: DisplayProfileInput[]
  authorizedBy: number
}

export interface SecondaryDisplayInfo {
  index: number
  width: number
  height: number
}

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year'

export interface SalesByPeriodPoint {
  period: string
  salesCount: number
  totalCents: number
}

export interface ProductPerformanceItem {
  productId: number
  productName: string
  qtySold: number
  revenueCents: number
}

export interface ProfitSummary {
  revenueCents: number
  costCents: number
  profitCents: number
}

export interface InventoryValuationItem {
  categoryName: string
  qty: number
  costCents: number
  retailCents: number
}

export interface InventoryValuationSummary {
  items: InventoryValuationItem[]
  totalCostCents: number
  totalRetailCents: number
}

export interface CashFlowSummary {
  cashInCents: number
  expensesCents: number
  netCents: number
}

export interface Expense {
  id: number
  date: string
  category: string
  amountCents: number
  note: string | null
  employeeName: string
}

export interface ExpenseCreateInput {
  date: string
  category: string
  amountCents: number
  note?: string
  employeeId: number
}

export interface DateRange {
  startDate: string
  endDate: string
}

export type InsightLevel = 'good' | 'warning' | 'critical' | 'info'

export interface InsightNavigateTo {
  screen: 'inventory' | 'salesHistory' | 'analytics'
  params?: Record<string, unknown>
}

export interface Insight {
  id: string
  level: InsightLevel
  message: string
  emphasis?: string
  navigateTo?: InsightNavigateTo
  priority: number
}

export interface AuditLogEntry {
  id: number
  employeeName: string | null
  action: string
  entityType: string
  entityId: number | null
  details: string | null
  createdAt: string
}

export interface AuditLogFilter {
  startDate: string
  endDate: string
  employeeId: number | null
  action: string | null
  search: string
}

export interface PosApi {
  auth: {
    login(pin: string): Promise<LoginResult>
  }
  setup: {
    status(): Promise<SetupStatus>
    createFirstManager(input: FirstManagerInput): Promise<SetupStatus>
  }
  license: {
    getState(): Promise<LicenseState>
    activate(input: LicenseActivateInput): Promise<LicenseState>
    recheck(): Promise<LicenseState>
    deactivate(): Promise<void>
    onState(callback: (state: LicenseState) => void): () => void
  }
  autoUpdate: {
    check(): Promise<void>
  }
  catalog: {
    list(): Promise<CatalogPayload>
  }
  sales: {
    create(input: CreateSaleInput): Promise<CreateSaleResult>
    list(date: string, search: string): Promise<SaleListItem[]>
    detail(saleId: number): Promise<SaleDetail>
    void(input: VoidSaleInput): Promise<SaleDetail>
    reprint(saleId: number): Promise<TestActionResult>
  }
  settings: {
    getAll(): Promise<SettingsPayload>
    update(input: SettingsUpdateInput): Promise<SettingsPayload>
    selectBackupFolder(): Promise<string | null>
    backupNow(folder: string): Promise<TestActionResult>
  }
  printer: {
    testPrint(): Promise<TestActionResult>
    testDrawerKick(): Promise<TestActionResult>
    onIssue(callback: (event: PrintIssueEvent) => void): () => void
  }
  customerDisplay: {
    setTestWindow(profileId: number, open: boolean): Promise<TestActionResult>
    listSecondaryDisplays(): Promise<SecondaryDisplayInfo[]>
  }
  till: {
    status(): Promise<TillStatus>
    open(input: { employeeId: number; openingCashCents: number }): Promise<TillStatus>
    close(input: { employeeId: number; closingCashCents: number }): Promise<TillCloseResult>
  }
  products: {
    list(): Promise<ProductsPayload>
    create(input: ProductCreateInput): Promise<ProductDetail>
    update(input: ProductUpdateInput): Promise<ProductDetail>
    delete(input: ProductDeleteInput): Promise<void>
  }
  inventory: {
    adjustStock(input: StockAdjustInput): Promise<StockAdjustResult>
  }
  dashboard: {
    summary(): Promise<DashboardSummary>
    salesTrend(): Promise<DailySalesPoint[]>
    employeePerformance(): Promise<EmployeePerformancePoint[]>
  }
  employees: {
    list(): Promise<EmployeeListItem[]>
    create(input: EmployeeCreateInput): Promise<EmployeeListItem>
    update(input: EmployeeUpdateInput): Promise<EmployeeListItem>
  }
  analytics: {
    salesByPeriod(period: AnalyticsPeriod): Promise<SalesByPeriodPoint[]>
    productPerformance(range: DateRange): Promise<ProductPerformanceItem[]>
    profit(range: DateRange): Promise<ProfitSummary>
    inventoryValuation(): Promise<InventoryValuationSummary>
    cashFlow(range: DateRange): Promise<CashFlowSummary>
    expenses: {
      list(range: DateRange): Promise<Expense[]>
      create(input: ExpenseCreateInput): Promise<Expense>
    }
  }
  promotions: {
    list(): Promise<Combo[]>
    create(input: ComboCreateInput): Promise<Combo>
    update(input: ComboUpdateInput): Promise<Combo>
  }
  displaySlides: {
    get(): Promise<DisplayProfile[]>
    update(input: DisplaySlidesUpdateInput): Promise<DisplayProfile[]>
  }
  insights: {
    get(): Promise<Insight[]>
  }
  auditLog: {
    list(filter: AuditLogFilter): Promise<AuditLogEntry[]>
  }
}
