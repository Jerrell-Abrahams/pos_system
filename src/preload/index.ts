import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnalyticsPeriod,
  AuditLogEntry,
  AuditLogFilter,
  CashFlowSummary,
  CatalogPayload,
  Category,
  CategoryCreateInput,
  CategoryDeleteInput,
  Combo,
  ComboCreateInput,
  ComboUpdateInput,
  CreateSaleInput,
  CreateSaleResult,
  DailySalesPoint,
  DashboardSummary,
  DateRange,
  DisplayProfile,
  DisplaySlidesUpdateInput,
  EmployeeCreateInput,
  EmployeeListItem,
  EmployeePerformancePoint,
  EmployeeUpdateInput,
  Expense,
  ExpenseCreateInput,
  FirstManagerInput,
  Insight,
  InventoryValuationSummary,
  LicenseActivateInput,
  LicenseState,
  LoginResult,
  PosApi,
  PrintIssueEvent,
  ProductCreateInput,
  ProductDeleteInput,
  ProductDetail,
  ProductPerformanceItem,
  ProductsPayload,
  ProductUpdateInput,
  ProfitSummary,
  SaleDetail,
  SaleListItem,
  SalesByPeriodPoint,
  SecondaryDisplayInfo,
  SettingsPayload,
  SettingsUpdateInput,
  SetupStatus,
  SplitPackInput,
  SplitPackResult,
  StockAdjustInput,
  StockAdjustResult,
  TestActionResult,
  TillCloseResult,
  TillStatus,
  VoidSaleInput
} from '@shared/types'

const api: PosApi = {
  auth: {
    login: (pin: string): Promise<LoginResult> => ipcRenderer.invoke('auth:login', pin)
  },
  setup: {
    status: (): Promise<SetupStatus> => ipcRenderer.invoke('setup:status'),
    createFirstManager: (input: FirstManagerInput): Promise<SetupStatus> =>
      ipcRenderer.invoke('setup:createFirstManager', input)
  },
  license: {
    getState: (): Promise<LicenseState> => ipcRenderer.invoke('license:getState'),
    activate: (input: LicenseActivateInput): Promise<LicenseState> => ipcRenderer.invoke('license:activate', input),
    recheck: (): Promise<LicenseState> => ipcRenderer.invoke('license:recheck'),
    deactivate: (): Promise<void> => ipcRenderer.invoke('license:deactivate'),
    onState: (callback: (state: LicenseState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: LicenseState): void => callback(data)
      ipcRenderer.on('license:state', listener)
      return () => ipcRenderer.removeListener('license:state', listener)
    }
  },
  autoUpdate: {
    check: (): Promise<void> => ipcRenderer.invoke('autoUpdate:check')
  },
  catalog: {
    list: (): Promise<CatalogPayload> => ipcRenderer.invoke('catalog:list'),
    createCategory: (input: CategoryCreateInput): Promise<Category> =>
      ipcRenderer.invoke('catalog:createCategory', input),
    deleteCategory: (input: CategoryDeleteInput): Promise<void> =>
      ipcRenderer.invoke('catalog:deleteCategory', input)
  },
  sales: {
    create: (input: CreateSaleInput): Promise<CreateSaleResult> => ipcRenderer.invoke('sales:create', input),
    list: (date: string, search: string): Promise<SaleListItem[]> => ipcRenderer.invoke('sales:list', date, search),
    detail: (saleId: number): Promise<SaleDetail> => ipcRenderer.invoke('sales:detail', saleId),
    void: (input: VoidSaleInput): Promise<SaleDetail> => ipcRenderer.invoke('sales:void', input),
    reprint: (saleId: number): Promise<TestActionResult> => ipcRenderer.invoke('sales:reprint', saleId)
  },
  settings: {
    getAll: (): Promise<SettingsPayload> => ipcRenderer.invoke('settings:getAll'),
    update: (input: SettingsUpdateInput): Promise<SettingsPayload> => ipcRenderer.invoke('settings:update', input),
    selectBackupFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:selectBackupFolder'),
    backupNow: (folder: string): Promise<TestActionResult> => ipcRenderer.invoke('settings:backupNow', folder)
  },
  printer: {
    testPrint: (): Promise<TestActionResult> => ipcRenderer.invoke('printer:testPrint'),
    testDrawerKick: (): Promise<TestActionResult> => ipcRenderer.invoke('printer:testDrawerKick'),
    onIssue: (callback: (event: PrintIssueEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: PrintIssueEvent): void => callback(data)
      ipcRenderer.on('printer:issue', listener)
      return () => ipcRenderer.removeListener('printer:issue', listener)
    }
  },
  customerDisplay: {
    setTestWindow: (profileId: number, open: boolean): Promise<TestActionResult> =>
      ipcRenderer.invoke('customerDisplay:setTestWindow', profileId, open),
    listSecondaryDisplays: (): Promise<SecondaryDisplayInfo[]> =>
      ipcRenderer.invoke('customerDisplay:listSecondaryDisplays')
  },
  window: {
    toggleFullscreen: (): Promise<void> => ipcRenderer.invoke('window:toggleFullscreen')
  },
  till: {
    status: (): Promise<TillStatus> => ipcRenderer.invoke('till:status'),
    open: (input: { employeeId: number; openingCashCents: number }): Promise<TillStatus> =>
      ipcRenderer.invoke('till:open', input),
    close: (input: { employeeId: number; closingCashCents: number }): Promise<TillCloseResult> =>
      ipcRenderer.invoke('till:close', input)
  },
  products: {
    list: (): Promise<ProductsPayload> => ipcRenderer.invoke('products:list'),
    create: (input: ProductCreateInput): Promise<ProductDetail> => ipcRenderer.invoke('products:create', input),
    update: (input: ProductUpdateInput): Promise<ProductDetail> => ipcRenderer.invoke('products:update', input),
    delete: (input: ProductDeleteInput): Promise<void> => ipcRenderer.invoke('products:delete', input)
  },
  inventory: {
    adjustStock: (input: StockAdjustInput): Promise<StockAdjustResult> =>
      ipcRenderer.invoke('inventory:adjustStock', input),
    splitPack: (input: SplitPackInput): Promise<SplitPackResult> => ipcRenderer.invoke('inventory:splitPack', input)
  },
  dashboard: {
    summary: (): Promise<DashboardSummary> => ipcRenderer.invoke('dashboard:summary'),
    salesTrend: (): Promise<DailySalesPoint[]> => ipcRenderer.invoke('dashboard:salesTrend'),
    employeePerformance: (): Promise<EmployeePerformancePoint[]> =>
      ipcRenderer.invoke('dashboard:employeePerformance')
  },
  employees: {
    list: (): Promise<EmployeeListItem[]> => ipcRenderer.invoke('employees:list'),
    create: (input: EmployeeCreateInput): Promise<EmployeeListItem> => ipcRenderer.invoke('employees:create', input),
    update: (input: EmployeeUpdateInput): Promise<EmployeeListItem> => ipcRenderer.invoke('employees:update', input)
  },
  analytics: {
    salesByPeriod: (period: AnalyticsPeriod): Promise<SalesByPeriodPoint[]> =>
      ipcRenderer.invoke('analytics:salesByPeriod', period),
    productPerformance: (range: DateRange): Promise<ProductPerformanceItem[]> =>
      ipcRenderer.invoke('analytics:productPerformance', range),
    profit: (range: DateRange): Promise<ProfitSummary> => ipcRenderer.invoke('analytics:profit', range),
    inventoryValuation: (): Promise<InventoryValuationSummary> =>
      ipcRenderer.invoke('analytics:inventoryValuation'),
    cashFlow: (range: DateRange): Promise<CashFlowSummary> => ipcRenderer.invoke('analytics:cashFlow', range),
    expenses: {
      list: (range: DateRange): Promise<Expense[]> => ipcRenderer.invoke('analytics:expenses:list', range),
      create: (input: ExpenseCreateInput): Promise<Expense> => ipcRenderer.invoke('analytics:expenses:create', input)
    }
  },
  promotions: {
    list: (): Promise<Combo[]> => ipcRenderer.invoke('promotions:list'),
    create: (input: ComboCreateInput): Promise<Combo> => ipcRenderer.invoke('promotions:create', input),
    update: (input: ComboUpdateInput): Promise<Combo> => ipcRenderer.invoke('promotions:update', input)
  },
  displaySlides: {
    get: (): Promise<DisplayProfile[]> => ipcRenderer.invoke('displaySlides:get'),
    update: (input: DisplaySlidesUpdateInput): Promise<DisplayProfile[]> =>
      ipcRenderer.invoke('displaySlides:update', input)
  },
  insights: {
    get: (): Promise<Insight[]> => ipcRenderer.invoke('insights:get')
  },
  auditLog: {
    list: (filter: AuditLogFilter): Promise<AuditLogEntry[]> => ipcRenderer.invoke('auditLog:list', filter)
  }
}

contextBridge.exposeInMainWorld('api', api)
