import { safeStorage } from 'electron'
import { createVerify } from 'crypto'
import { hostname } from 'os'
import type Database from 'better-sqlite3'
import { ensureDeviceId } from '../db/deviceId'
import { LICENSE_EXPIRY_GRACE_DAYS, type LicenseReason, type LicenseState } from '@shared/types'

export interface SuperUserClaim {
  salt: string
  hash: string
}

export interface CertificatePayload {
  userId: string
  product: string
  status: string
  periodEnd: string
  issuedAt: number
  // Absent unless this subscription has a super_user_code set on the license platform.
  superUser?: SuperUserClaim
}

interface EvaluationResult {
  entitled: boolean
  reason: LicenseReason | null
}

// Baked into the bundle at build time by electron.vite.config.ts (`main.define`) — a packaged
// main process only ever sees the end user's environment at runtime, so reading process.env here
// directly is what left production pointing at a placeholder that no customer could activate
// against. Empty means a dev build: `npm run dist`/`release` refuse to package without it.
// Trailing slash stripped so `${LICENSE_API_URL}/api/...` can't become `//api/...` — a baked URL
// with a stray slash would 404 every activation in production, where it's expensive to diagnose.
const LICENSE_API_URL = (process.env.LICENSE_API_URL ?? '').replace(/\/+$/, '')
const PRODUCT_SLUG = 'pos-system'
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000
export const LICENSE_RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

// ponytail: dev bypass -- ELECTRON_RENDERER_URL is only set by `electron-vite dev` (same
// signal main/index.ts already uses to pick dev vs packaged renderer loading), so this is off
// for both vitest runs and real installers. Yields to a real check whenever LICENSE_API_URL
// is explicitly set (e.g. pointed at a local license-platform instance for testing).
const DEV_MODE = Boolean(process.env['ELECTRON_RENDERER_URL']) && !LICENSE_API_URL

// Public half of license-platform's LICENSE_CERT_PRIVATE_KEY (src/lib/licenseCert.js).
// Safe to ship -- it can only verify certificates, never forge them.
const LICENSE_CERT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArLu7cKqSvqIl5e99QFCl
67qYypefEvUqL48zsDdI3d8oS84fuZW3bW+iDtdK0CMgh62YYihcr5NYQ5qUOKnH
E3X+ngz6ajv0isIXJXcEVjRQiUYcKA2VNOV+EYY81EwIFEwWa5yEKMHWTw7mE5PV
Gw/v940uQCWCk3EdjFF9Nx4gV7kvwKpbXhy/HhKuJLtQi13rSiGCtiBqaAAVl4BH
1oAxFPefMAAlh9JZ3aUw775zymzkKNGLOqRCUqKp3lfZUdp37ZjTfd+e5RibpOhJ
jbPDnv9N1EmgMlnJZMhVGJZgtjfokdiX9JamXL+gZcORyoWmvCZo7aLyCKl+QX4Q
9wIDAQAB
-----END PUBLIC KEY-----`

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

function storeCredentials(db: Database.Database, email: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level credential encryption is not available on this device')
  }
  const encrypted = safeStorage.encryptString(JSON.stringify({ email, password }))
  setSetting(db, 'license_credentials', encrypted.toString('base64'))
}

function getStoredCredentials(db: Database.Database): { email: string; password: string } | null {
  const raw = getSetting(db, 'license_credentials')
  if (!raw) return null
  const decrypted = safeStorage.decryptString(Buffer.from(raw, 'base64'))
  return JSON.parse(decrypted) as { email: string; password: string }
}

async function login(email: string, password: string): Promise<string> {
  if (!LICENSE_API_URL) {
    // Never send credentials to a URL we don't have -- reaching this means the build skipped
    // the packaging guard, so fail closed rather than posting an email/password anywhere.
    throw new Error('This build has no license server configured — reinstall from an official release')
  }
  const res = await fetch(`${LICENSE_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = (await res.json()) as { token?: string; error?: string }
  if (!res.ok || !data.token) throw new Error(data.error || 'Login failed')
  return data.token
}

function verifyCertificate(cert: string): CertificatePayload | null {
  const parts = cert.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts
  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${headerB64}.${payloadB64}`)
    verifier.end()
    if (!verifier.verify(LICENSE_CERT_PUBLIC_KEY, Buffer.from(sigB64, 'base64url'))) return null
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as CertificatePayload
  } catch {
    return null
  }
}

// The last certificate the server issued: signature-checked, but deliberately NOT
// entitlement-checked. Anything gating a feature wants isEntitledSync instead. This exists
// for the super user code, which is carried inside the certificate and has to be checkable
// while the till is offline (see lib/superUser.ts).
export function readCachedCertificate(db: Database.Database): CertificatePayload | null {
  const cached = getSetting(db, 'license_certificate')
  return cached ? verifyCertificate(cached) : null
}

const EXPIRY_GRACE_MS = LICENSE_EXPIRY_GRACE_DAYS * 24 * 60 * 60 * 1000

// Entitlement based purely on what the certificate claims -- used right after
// a fresh server round-trip, so no offline grace period applies here. Still
// entitled for EXPIRY_GRACE_MS past periodEnd -- the app warns instead of
// locking up the moment the billing period ends, per product decision.
export function evaluateEntitlement(payload: CertificatePayload | null, now: number): EvaluationResult {
  if (!payload) return { entitled: false, reason: 'not_activated' }
  if (payload.status !== 'active') return { entitled: false, reason: payload.status as LicenseReason }
  if (new Date(payload.periodEnd).getTime() + EXPIRY_GRACE_MS < now) return { entitled: false, reason: 'expired' }
  return { entitled: true, reason: null }
}

// Same as above, plus requires the certificate to have been issued within
// GRACE_PERIOD_MS of now -- this is what caps how long the POS keeps working
// while it can't reach the license server at all.
export function evaluateOfflineEntitlement(payload: CertificatePayload | null, now: number): EvaluationResult {
  const base = evaluateEntitlement(payload, now)
  if (!base.entitled || !payload) return base
  if (now - payload.issuedAt > GRACE_PERIOD_MS) return { entitled: false, reason: 'verification_required' }
  return base
}

// Detects the system clock moving backward since the app last observed a
// timestamp -- otherwise a user could repeatedly rewind the clock to keep
// resetting the offline grace period above indefinitely. Deliberately
// separate from the certificate checks above: comparing a client clock
// against the *server's* issuedAt would misfire on ordinary clock skew of a
// few seconds; this only ever compares the local clock against itself.
export function isClockRolledBack(db: Database.Database, now: number): boolean {
  const stored = getSetting(db, 'license_max_seen_at')
  return stored !== null && now < Number(stored)
}

function recordSeenTime(db: Database.Database, now: number): void {
  const stored = getSetting(db, 'license_max_seen_at')
  if (!stored || now > Number(stored)) setSetting(db, 'license_max_seen_at', String(now))
}

// Synchronous, no network -- safe to call from hot IPC paths (sales:create,
// till:open) as a defense-in-depth check against the last-cached certificate.
export function isEntitledSync(db: Database.Database): boolean {
  if (DEV_MODE) return true
  const now = Date.now()
  if (isClockRolledBack(db, now)) return false
  const cached = getSetting(db, 'license_certificate')
  const payload = cached ? verifyCertificate(cached) : null
  return evaluateOfflineEntitlement(payload, now).entitled
}

export async function activate(
  db: Database.Database,
  email: string,
  password: string,
  deviceName: string = hostname()
): Promise<LicenseState> {
  // Match checkStatus/isEntitledSync: a dev build has no license server to activate against, so
  // clicking Activate here would otherwise throw the "no license server configured" error at a
  // developer who is already auto-entitled. Nothing to store — dev entitlement isn't cert-backed.
  if (DEV_MODE) return { entitled: true, reason: null, periodEnd: null }

  const token = await login(email, password)
  const deviceFingerprint = ensureDeviceId(db)
  const res = await fetch(`${LICENSE_API_URL}/api/subscription/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ product: PRODUCT_SLUG, deviceFingerprint, deviceName })
  })
  const data = (await res.json()) as { certificate?: string; error?: string }
  if (!res.ok || !data.certificate) throw new Error(data.error || 'Activation failed')

  storeCredentials(db, email, password)
  setSetting(db, 'license_certificate', data.certificate)

  const now = Date.now()
  recordSeenTime(db, now)
  const payload = verifyCertificate(data.certificate)
  const result = evaluateEntitlement(payload, now)
  return { entitled: result.entitled, reason: result.reason, periodEnd: payload?.periodEnd ?? null }
}

// Clears activation state only -- till_device_id is device identity, not
// tenant identity, and re-activating on the same device should keep it.
export function deactivate(db: Database.Database): void {
  db.prepare(`DELETE FROM settings WHERE key IN ('license_credentials', 'license_certificate', 'license_max_seen_at')`).run()
}

export async function checkStatus(db: Database.Database): Promise<LicenseState> {
  if (DEV_MODE) return { entitled: true, reason: null, periodEnd: null }
  const now = Date.now()
  if (isClockRolledBack(db, now)) return { entitled: false, reason: 'clock_rollback', periodEnd: null }

  const creds = getStoredCredentials(db)
  if (!creds) return { entitled: false, reason: 'not_activated', periodEnd: null }

  try {
    const token = await login(creds.email, creds.password)
    const res = await fetch(`${LICENSE_API_URL}/api/subscription/status?product=${PRODUCT_SLUG}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = (await res.json()) as { certificate?: string; error?: string }
    if (!res.ok || !data.certificate) throw new Error(data.error || 'Status check failed')

    recordSeenTime(db, now)
    setSetting(db, 'license_certificate', data.certificate)
    const payload = verifyCertificate(data.certificate)
    const result = evaluateEntitlement(payload, now)
    return { entitled: result.entitled, reason: result.reason, periodEnd: payload?.periodEnd ?? null }
  } catch {
    // network/API unreachable -- fall back to the last cached certificate
    const cached = getSetting(db, 'license_certificate')
    const payload = cached ? verifyCertificate(cached) : null
    const result = evaluateOfflineEntitlement(payload, now)
    return { entitled: result.entitled, reason: result.reason, periodEnd: payload?.periodEnd ?? null }
  }
}
