# Testing the super user code in dev

## Why it fails by default

In `npm run dev`, `LICENSE_API_URL` is empty → `DEV_MODE = true` (`src/main/lib/license.ts`).
In that mode the POS auto-entitles and **never fetches a certificate**. The super user
code is checked against the `superUser` claim *inside* the cached cert — no cert, no claim,
so the code is rejected every time. Nothing is broken; there's just nothing to check against.

Setting `LICENSE_API_URL` turns `DEV_MODE` off, so the app does a real activation and stores
a cert that carries the claim.

## One-time setup

```powershell
setx LICENSE_API_URL "http://localhost:3000"
```

`setx` only affects **new** terminals — close the current one afterward.

On the license platform: set `super_user_code` on the `pos-system` subscription row
(admin UI or SQL). Use a different random 4–6 digit code per customer.

## Every test run

```powershell
# Terminal 1 — license server (:3000)
cd C:\Users\User\Desktop\subscription_management_system\subscription_management_system
npm run dev

# Terminal 2 — POS (must be a NEW terminal opened after setx)
cd C:\Users\User\Desktop\pos_system\pos_system
echo $env:LICENSE_API_URL     # MUST print http://localhost:3000 — if blank, stop
npm run dev
```

Then in the app:
1. **Activate** (licence email/password → Activate). The app now demands this instead of
   dropping straight into the POS — that's the sign `DEV_MODE` is off. This stores the cert.
2. Type the super user code on the PIN keypad → signs in as "Super User" (manager rights).

Order matters: set `super_user_code` **before** activating. If already activated, restart
the POS so `checkStatus` re-fetches a cert with the claim.

## Verify the cert landed

Decode the cached cert from the POS DB:

```powershell
python -c "import sqlite3,json,base64; d=sqlite3.connect(r'C:\Users\User\AppData\Roaming\pos-system\pos.db'); c=dict(d.execute(\"SELECT key,value FROM settings WHERE key LIKE 'license%'\").fetchall()).get('license_certificate'); print('no cert' if not c else ('has superUser claim: '+str('superUser' in json.loads(base64.urlsafe_b64decode(c.split('.')[1]+'==')))))"
```

- `no cert` → `DEV_MODE` still on (env var didn't reach the build) **or** you never activated.
- `has superUser claim: True` → good, the keypad code will work.
- `has superUser claim: False` → cert has no code; set `super_user_code` and re-activate.

## Before building a real installer

Clear the var so you never ship a build pointing at localhost:

```powershell
setx LICENSE_API_URL ""
```

(`scripts/require-license-url.js` also refuses to package an empty URL.)
