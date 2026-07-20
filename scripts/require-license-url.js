// Fills process.env from .env for local/manual builds; a real shell-exported var (e.g. in CI)
// always wins, and a missing .env (fresh clone, since it's gitignored) is fine too.
try {
  process.loadEnvFile()
} catch {}

// A packaged Electron main process reads the end user's environment at runtime, never the build
// machine's — so LICENSE_API_URL has to be baked into the bundle at build time (see the `define`
// block in electron.vite.config.ts). Without it every customer's activation fails on install,
// and nothing about the build itself looks wrong. Fail here instead, where it's cheap.
if (!process.env.LICENSE_API_URL) {
  console.error('\nRefusing to package: LICENSE_API_URL is not set.\n')
  console.error('It gets frozen into the build, so an unset value ships an app that')
  console.error('no customer can activate. Set it to the license API base URL first:\n')
  console.error('  PowerShell:  $env:LICENSE_API_URL="https://your-license-api"; npm run dist')
  console.error('  bash:        LICENSE_API_URL=https://your-license-api npm run dist\n')
  process.exit(1)
}
