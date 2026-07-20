// electron-builder runs as its own process, spawned fresh by the shell `&&` chain — it never
// sees .env's GH_TOKEN, even though require-license-url.js already loaded one (that load dies
// with that process, since env vars can't cross from one process to a sibling). Load it again
// here, in the one process that actually needs it.
try {
  process.loadEnvFile()
} catch {}

if (!process.env.GH_TOKEN) {
  console.error('\nRefusing to publish: GH_TOKEN is not set.\n')
  console.error('electron-builder needs it to create/update the GitHub release. Set it first:\n')
  console.error('  PowerShell:  $env:GH_TOKEN="ghp_..."; npm run release\n')
  process.exit(1)
}

require('node:child_process').execSync(`electron-builder ${process.argv.slice(2).join(' ')}`, {
  stdio: 'inherit'
})
