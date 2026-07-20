# POS System — Functional Specification

Offline-first point-of-sale desktop app for small local businesses (bottle stores / retail), built with Electron + React + SQLite. Single till device per install, with an optional second-screen customer display. All money is stored/handled in integer cents; currency formatting is South African Rand (R).

## 1. Platform & Architecture

- **Shell**: Electron (main process = Node/SQLite backend, renderer = React UI), preload bridges a typed `window.api` (see `src/shared/types.ts` `PosApi`) over IPC.
- **Database**: `better-sqlite3`, single local file, versioned migrations (`src/main/db/migrations`), auto-run on launch. Seeding is split by build type: genuine operating defaults (VAT rate, auto-lock, thresholds) seed on every install, while the demo shop (a "Thirsty Springbok" bottle store: 5 categories, 20 products, 1 manager + 1 cashier) seeds **only under `electron-vite dev`**. A packaged build therefore seeds no employees and no shop identity at all — that empty state is exactly what routes a real install into first-run setup.
- **Offline-first sync**: every write to sales, sale_items, payments, stock_moves, products, expenses, combos, and tills is mirrored into a local `sync_queue` (outbox) table as JSON payloads for later upstream sync — no sync target is implemented yet, this is the local staging log.
- **Licensing**: subscription-gated via a remote license server (`checkStatus`/`activate`), with RSA-signed offline certificates, a 7-day offline grace period, periodic re-check (every 6h) and background push of license state to the renderer, and clock-rollback detection to stop grace-period abuse. Dev builds bypass licensing entirely.
- **Hardware**: ESC/POS thermal receipt printer (via `node-thermal-printer`) with cash-drawer kick, and an optional second-monitor customer-facing display window.
- **Testing**: Vitest unit tests for money/receipt math, license evaluation, insights engine, audit log, customer display.

## 2. Roles & Access Control

Two roles: **cashier** and **manager**. Enforced both in the renderer nav (manager-only screens hidden) and re-checked in every mutating main-process IPC handler (never trust the renderer).

**First-run setup**: an install with no employees cannot be logged into, so a fresh (packaged) install shows a setup screen that collects the business name and creates the first manager account + PIN. `setup:createFirstManager` is the only handler that creates an account without a manager PIN authorizing it — "no employees exist yet" is its entire trust boundary, re-checked inside the write transaction, and it refuses once any employee exists. Everything else (staff, catalog, VAT number, printer) is configured from Settings afterwards.

- **Cashier**: run sales, open/close till, view POS/inventory/sales-history-for-today.
- **Manager**: everything a cashier can do, plus Settings, Analytics, Promotions, Employees, full Sales History/audit log, and is the only role that can authorize: discounts above threshold, voids, stock adjustments, product/employee/combo create-or-edit, settings changes.
- Login is **PIN-based** (4–6 digits, bcrypt-hashed), no usernames — PIN alone identifies the employee among active staff. PINs must be unique among active employees. System enforces at least one active manager always remains.
- Auto-lock: idle timer (configurable seconds, default 90s) logs the current employee out back to PIN entry.
- Manager-PIN modal pattern: sensitive cashier-initiated actions (large discount, void) prompt for a manager's PIN inline rather than requiring a full role switch.

## 3. Point of Sale (Cashier Screen)

- Product grid browsable by category rail, plus free-text/barcode search across name and barcode.
- **Barcode scanning**: keyboard-wedge scanner support — buffers fast keystrokes (<30ms gaps) ending in Enter, treated as a scanned code (min 4 chars) and added to cart automatically, with a screen-flash + beep for feedback.
- **Combos/Promotions**: a dedicated combo grid (bundle deals) alongside the product grid; adding a combo adds its constituent items to the cart at a bundled discount.
- **Cart**: line items with qty steppers, per-line removal, running subtotal; supports mixed product lines + combo lines.
- **Discounts**: manual discount (fixed cents) applicable to the sale; if the discount exceeds a configurable threshold percent of subtotal (default 20%), manager authorization is required.
- **VAT**: optional, inclusive-VAT calculation at a configurable rate (default 15%, South African VAT), computed on the post-discount total.
- **Combo pricing**: combo discount is computed server-side from current product prices vs. the combo's set price (not trusted from renderer); cart must actually contain the required component items for the combo to apply.
- **Payment**: cash, card, or EFT, or a split across multiple methods (`SplitPaymentBuilder`). Cash flow includes a numeric keypad, quick-cash buttons (R50/R100/R200), "exact amount," live change calculation, and a change-due confirmation screen. Card/EFT stages are a manual "confirm after terminal payment" step (no real payment terminal integration). Payments must sum exactly to the sale total.
- Successful sale: generates a sequential global receipt number (`R000001…`), decrements stock, records stock_moves, prints a receipt asynchronously (queued so a printer fault never blocks/rolls back the sale), and kicks the cash drawer if cash was tendered.
- Till must be **open** to sell; if not, the cashier is shown an "Open Till" panel instead of the POS screen.

## 4. Till (Cash Drawer Session) Management

- One open till at a time, tied to a per-device ID.
- **Open**: cashier/manager enters opening float (cash cents); blocked if a till is already open, and blocked if the subscription is inactive.
- **Expected cash** = opening float + all cash payments recorded against completed sales in that till session (live-computed, not stored).
- **Close**: enter counted closing cash; system computes and stores the variance (difference vs. expected) for reconciliation and feeds the "cash variance" dashboard insight.
- All open/close events are audit-logged and outboxed.

## 5. Sales & Refunds

- **Sales history**: per-day listing (default today), filterable by receipt number or cashier name; sale detail view shows line items, payments, subtotal/discount/combo-discount/VAT/total.
- **Void**: manager-authorized only, requires a free-text reason, only allowed on `completed` sales (not already voided/refunded). Restores stock for all voided line items and logs a stock_move + audit entry.
- **Reprint**: re-queues a receipt print (marked "VOIDED — NOT VALID" if applicable) without re-kicking the cash drawer.
- Sale statuses: `completed`, `voided`, `refunded` (refunded status modeled but no dedicated refund flow beyond void was found in the explored code).

## 6. Product & Inventory Management (Manager)

- **Categories**: name + manual sort order.
- **Products**: name, category, sell price, cost price, stock quantity (supports fractional, e.g. tots/decimals), low-stock threshold (default 5), barcode, active flag. Create/update requires manager auth; validates name and positive sell price.
- **Stock adjustments**: manual +/- quantity changes with a required reason (e.g. breakage, stocktake correction, goods received) — manager-only, logged as a `stock_moves` row of type `adjustment` and to the audit log with before/after quantity.
- Stock automatically moves on sale (`sale`, negative) and void (`refund`, positive).
- **Low stock**: dashboard count + inventory screen highlighting of products at/under threshold.

## 7. Promotions (Combos)

- Manager-managed bundle deals: a name, a bundle price, and a list of component products + required quantities.
- `componentsCents` shown to managers = what the bundle's parts would cost at current individual prices, for comparison against the bundle price.
- Can be activated/deactivated without deletion (soft toggle via `active`).
- At sale time, discount is recomputed from live prices — not stored/trusted from when the combo was configured — and can even be *negative* (a surcharge) if a combo is priced above its parts, which is intentionally not clamped to zero.

## 8. Employee Management (Manager)

- List, create, update employees: name, PIN, role, active flag.
- PIN format enforced (4–6 digits), uniqueness enforced among active employees only (inactive employees' old PINs are free to reuse).
- Safeguard: cannot deactivate/demote the last remaining active manager.
- All create/update actions are audit-logged with before/after diffs.

## 9. Dashboard (Home / Business Health)

- **Today's summary**: sales count, total revenue, VAT collected, payment-method breakdown (cash/card/EFT), voided-sale count, low-stock product count, current till status.
- **Sales trend**: last 14 days daily revenue chart.
- **Employee performance**: last 14 days, sales count + revenue per active employee (ranked, zero-filled for employees with no sales).
- **Business Health / Insights panel** — a small automated rules engine (max 6 insights shown, sorted critical → warning → info → good, then by priority):
  - **Cash variance**: flags last till-close cash short/over by more than a threshold (default R50), or confirms it balanced.
  - **Stock runout**: projects days-of-stock remaining from a 14-day sales rate; warns at ≤5 days, critical at ≤2 days (bundles into a single "N products low" card if multiple).
  - **Void spike**: flags today's void/refund count if ≥3 and at least 2x the 20-day daily average.
  - **Sales trend**: compares today-so-far vs. the same time-of-day last week; flags +5% up (good) or -15% down (warning).
  - **Revenue concentration**: (needs ≥20 items sold today) reports what % of today's revenue came from the top 5 products.
  - **Peak hour**: (after 3+ completed hours today) surfaces the busiest hour-of-day so far by revenue.
  - Insights can carry a "navigate to" deep link (e.g. jump straight to low-stock inventory, voided sales history, or a specific analytics report).

## 10. Analytics (Manager)

- **Sales by period**: day (30pt)/week(12)/month(12)/year(5) aggregated counts + totals.
- **Product performance**: qty sold + revenue per active product over a date range.
- **Profit summary**: revenue − cost over a date range (cost uses *current* product cost price, not a historical snapshot at sale time — a known simplification).
- **Inventory valuation**: stock qty/cost value/retail value grouped by category, plus grand totals.
- **Cash flow**: cash received vs. recorded expenses over a date range, net figure.
- **Expenses**: manager-logged operating expenses (date, category, amount, note, recorded-by employee); listed and created via a simple form.

## 11. Settings (Manager)

- Business name & address (used on receipts).
- VAT toggle + rate percent (0–100).
- Auto-lock idle timeout (min 10s).
- Manual-discount authorization threshold percent (0–100).
- Receipt footer text.
- Printer interface string (device path/connection string for the thermal printer).
- Customer-facing display on/off toggle.
- All changes require manager auth and are diffed + audit-logged.

## 12. Audit Log (Manager)

- Immutable log of every sensitive action: sale create/void, till open/close, product/employee/combo/settings create-or-update, stock adjustments — each with actor, action, entity type/id, timestamp, and a JSON details blob (often a before/after field diff).
- Searchable/filterable screen: date range, employee, action type, free-text search across action/entity/employee name.

## 13. Receipts & Printing

- Plain-text ESC/POS receipt: business name/address, receipt #, date/time, cashier, line items (qty × name, unit price = line total), subtotal, discount, promotions discount (or "combo adjustment" if it was a surcharge), total, VAT-inclusive note, per-payment breakdown (method, tendered, change), footer message, and a "VOIDED — NOT VALID" banner on reprints of voided sales.
- **Print queue**: printing is decoupled from the sale transaction — a print failure never blocks or reverts a completed sale. Failed jobs stay queued and retry every 30s indefinitely; the cashier is toasted once per failing job (not spammed every retry) so a temporarily offline printer doesn't lock up the workflow.
- **Cash drawer**: kicked automatically on any cash-tendered sale; also has a manual test-kick in Settings, plus a printer test-print button.

## 14. Customer-Facing Display (optional)

- If enabled in Settings and a second monitor is connected, opens a fullscreen, frameless window on that display, loading the same renderer bundle at a `#customer-display` route (no separate build — `main.tsx` picks the alternate root component off the URL hash).
- Automatically attaches/detaches as monitors are plugged/unplugged (listens to Electron's `display-added`/`display-removed`); closes itself if no second display is present.
- **Not a live cart/total mirror** — it does not receive the in-progress sale from the POS screen. It's an independent, self-polling digital signage slideshow: fetches promotions and the product catalog every 60s and auto-rotates every 8s between a "Promotions" slide (active combo deals + prices) and a "Prices" slide (full product price grid).

## 15. Licensing & Subscription Gating

- Subscription must be **activated** (email/password login against a license API) before the app is usable; credentials are stored OS-encrypted (`safeStorage`) for silent background re-login.
- Certificates are RSA-signed by the license server and locally verified (public key embedded, no network call needed to verify signature).
- **Offline grace period**: 7 days from the certificate's issue date — after that, the app demands `verification_required` (a fresh server check) even if the cached certificate claims to still be active.
- **Clock-rollback protection**: the app tracks the max wall-clock time it has ever observed; if the system clock goes backward, entitlement is revoked (`clock_rollback`) to prevent gaming the grace period by turning the clock back.
- Background re-check every 6 hours while running, pushing state changes live to the renderer; hot paths (`sales:create`, `till:open`) also do a fast synchronous local re-check as defense in depth.
- Failure/expired/canceled/past-due/revoked states all route to a blocking `LicenseGateScreen` before any POS functionality is reachable.
- Dev-mode bypass: license checks are skipped entirely when running under `electron-vite dev`.

## 16. Cross-Cutting Behaviors

- All monetary math is integer-cents based (no floats), with a dedicated `money.ts` (VAT-inclusive calc, discount clamping 0..subtotal, change calc, payment-coverage/remaining calc) and `formatRands`/`formatRandsWhole` helpers.
- Every mutating IPC handler re-validates authorization and business rules server-side (main process), never trusting renderer-supplied flags — the renderer is UI only.
- Crash logging installed at process start (`installCrashHandlers`).
- Single-instance app lock (a second launch focuses/does nothing rather than opening a duplicate).
- Toast notifications surface async issues (e.g. print failures) without interrupting the current screen.

## 17. Known Simplifications (as found in code, marked deliberately in comments)

- Profit reports use current cost price, not cost-at-time-of-sale (drifts if costs change frequently).
- No real payment-terminal integration for card/EFT — cashier manually confirms after taking payment on a separate terminal.
- No implemented remote sync consumer yet — the outbox/sync_queue is populated but nothing drains it (staged for a future sync service).
- Refund is modeled as a status but the observed flow is void-only, not a partial-refund UI.
