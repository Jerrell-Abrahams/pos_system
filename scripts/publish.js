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

const { execSync } = require('node:child_process')
const cmd = `electron-builder ${process.argv.slice(2).join(' ')}`

// electron-builder fires one "create release" call per uploaded artifact (exe + blockmap);
// whichever call loses that race gets back a 422 "already_exists" and aborts the whole run,
// even though the winner's release now exists with some assets already on it. This has hit
// nearly every publish so far -- re-running always fixes it (electron-builder sees the release
// already exists and just uploads what's still missing), so do that automatically once instead
// of a human re-running the same command by hand again.
try {
  execSync(cmd, { stdio: 'inherit' })
} catch {
  console.error('\nPublish failed (likely the known concurrent-release race) -- retrying once...\n')
  execSync(cmd, { stdio: 'inherit' })
}
