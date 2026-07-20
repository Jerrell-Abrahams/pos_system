import { scryptSync, timingSafeEqual } from 'crypto'
import type Database from 'better-sqlite3'
import { SUPER_USER_ID } from '@shared/types'
import { readCachedCertificate } from './license'

// Must match src/lib/superUserCode.js on the licence platform, which derives the hash this
// compares against. Pinned rather than defaulted so a Node version difference between the
// two can't silently turn every correct code into a wrong one.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 32

// For handlers that write an employee id into a foreign key. The FK would reject it anyway;
// this just turns "FOREIGN KEY constraint failed" into something a person can act on.
export function requireRealEmployee(employeeId: number): void {
  if (employeeId === SUPER_USER_ID) {
    throw new Error('The super user cannot perform this action — sign in with an employee PIN')
  }
}

// Checks a code against the claim in the cached certificate. Read from the cache rather than
// the network on purpose: this is an offline-first POS, and a till can be entitled but offline
// for days (see GRACE_PERIOD_MS) — support still has to be able to sign in there.
//
// Entitlement isn't consulted, but that doesn't grant access to an unlicensed till: the licence
// gate in App.tsx renders before the login screen exists, so there's nothing to type a code into
// until the subscription is healthy. Reactivate it from the admin dashboard instead. Returns
// false on a never-activated till too — no certificate means no claim to check against.
export function isSuperUserCode(db: Database.Database, code: string): boolean {
  const claim = readCachedCertificate(db)?.superUser
  if (!claim || !code) return false

  const expected = Buffer.from(claim.hash, 'base64')
  if (expected.length !== KEY_LENGTH) return false

  const actual = scryptSync(code, claim.salt, KEY_LENGTH, SCRYPT_PARAMS)
  return timingSafeEqual(expected, actual)
}
