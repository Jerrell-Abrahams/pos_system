import { describe, expect, it, vi } from 'vitest'
import { randomBytes, scryptSync } from 'crypto'

const cert = vi.hoisted(() => ({ payload: null as unknown }))
vi.mock('./license', () => ({ readCachedCertificate: () => cert.payload }))

import { SUPER_USER_ID } from '@shared/types'
import { isSuperUserCode, requireRealEmployee } from './superUser'

// Mirrors src/lib/superUserCode.js on the licence platform. If these two ever drift, every
// correct code silently becomes wrong on every till — so the point of this file is that the
// derivation is pinned on both sides, not just that the comparison works.
function serverClaim(code: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('base64')
  return { salt, hash: scryptSync(code, salt, 32, { N: 16384, r: 8, p: 1 }).toString('base64') }
}

const db = {} as never

describe('isSuperUserCode', () => {
  // The code is typed on the normal PIN keypad, which emits 4-6 digits and nothing else.
  it('accepts a 6-digit keypad code the licence platform hashed', () => {
    cert.payload = { superUser: serverClaim('409271') }
    expect(isSuperUserCode(db, '409271')).toBe(true)
  })

  // Leading zeros survive: the column is text, and a code read as a number would lose them.
  it('accepts a code with a leading zero', () => {
    cert.payload = { superUser: serverClaim('004271') }
    expect(isSuperUserCode(db, '004271')).toBe(true)
    expect(isSuperUserCode(db, '4271')).toBe(false)
  })

  it('rejects a wrong code', () => {
    cert.payload = { superUser: serverClaim('409271') }
    expect(isSuperUserCode(db, '409270')).toBe(false)
    expect(isSuperUserCode(db, '')).toBe(false)
  })

  it('rejects when the subscription has no code set', () => {
    cert.payload = { superUser: undefined }
    expect(isSuperUserCode(db, 'anything')).toBe(false)
  })

  // A till that was never activated has no certificate to carry a claim, so there is
  // nothing to check against — super access genuinely cannot work there.
  it('rejects when the device has no certificate', () => {
    cert.payload = null
    expect(isSuperUserCode(db, 'anything')).toBe(false)
  })

  // Entitlement is not consulted here — the licence gate is what keeps an unlicensed till
  // shut, and it renders before any login screen. This function only answers "is this the
  // code", so it must keep saying yes on a till that's merely offline mid-grace-period.
  it('accepts regardless of the certificate status field', () => {
    cert.payload = { status: 'revoked', superUser: serverClaim('let-me-in') }
    expect(isSuperUserCode(db, 'let-me-in')).toBe(true)
  })

  it('rejects a claim whose hash is the wrong length', () => {
    cert.payload = { superUser: { salt: 'abc', hash: Buffer.from('short').toString('base64') } }
    expect(isSuperUserCode(db, 'anything')).toBe(false)
  })
})

describe('requireRealEmployee', () => {
  it('blocks the super user from identity-bound writes', () => {
    expect(() => requireRealEmployee(SUPER_USER_ID)).toThrow(/super user/i)
  })

  it('allows a real employee', () => {
    expect(() => requireRealEmployee(1)).not.toThrow()
  })
})
