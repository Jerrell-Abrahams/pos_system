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
const pkg = require('../package.json')
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

// The race above has a second, silent form: both concurrent "create release" calls can each
// succeed (no 422), leaving two separate releases on the same tag with the assets split between
// them -- e.g. one holds only the blockmap, the other holds latest.yml + the installer. No error,
// no retry trigger, and tills fail their update check on whichever incomplete one they hit. Clean
// that up here by keeping the release with the most assets (the complete one) and deleting the rest.
async function cleanupDuplicateReleases() {
  const { owner, repo } = pkg.build.publish
  const tag = `v${pkg.version}`
  const headers = {
    'User-Agent': 'pos-system-publish-script',
    Authorization: `token ${process.env.GH_TOKEN}`
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers })
  if (!res.ok) return
  const releases = (await res.json()).filter((r) => r.tag_name === tag)
  if (releases.length <= 1) return

  releases.sort((a, b) => b.assets.length - a.assets.length)
  const [keep, ...duplicates] = releases
  console.error(
    `\nFound ${releases.length} releases for tag ${tag} (concurrent-release race) -- keeping id=${keep.id} (${keep.assets.length} assets), deleting the rest...\n`
  )
  for (const dup of duplicates) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${dup.id}`, { method: 'DELETE', headers })
    console.error(`Deleted duplicate release id=${dup.id} (${dup.assets.length} assets)`)
  }
}

cleanupDuplicateReleases().catch((err) => console.error('\nDuplicate-release cleanup failed:', err.message))
