// electron-builder runs as its own process, spawned fresh by the shell `&&` chain — it never
// sees .env's GH_TOKEN, even though require-license-url.js already loaded one (that load dies
// with that process, since env vars can't cross from one process to a sibling). Load it again
// here, in the one process that actually needs it.
try {
  process.loadEnvFile()
} catch {}

const { execSync } = require('node:child_process')
const pkg = require('../package.json')
const args = process.argv.slice(2)
const cmd = `electron-builder ${args.join(' ')}`

const { owner, repo } = pkg.build.publish
const tag = `v${pkg.version}`
const headers = {
  'User-Agent': 'pos-system-publish-script',
  Authorization: `token ${process.env.GH_TOKEN}`
}

// Which flavor is this? `release:instant` passes -c.publish.releaseType=release and goes live to
// every till on its next check; everything else stages a prerelease that electron-updater ignores
// until promoted. Exported because getting it backwards is the one bug here with real blast
// radius -- it either ships an unvetted build to every tenant or silently stages one meant to go
// live -- and neither shows up as an error anywhere.
const isLiveRelease = (argv) => argv.some((a) => a.includes('releaseType=release'))

// Root cause of the duplicate releases below: app-builder-lib's PublishManager caches its
// publisher *after* an await (`publisher = await createPublisher(...)` then `.set(...)`), so the
// exe and its blockmap -- scheduled concurrently -- both miss the cache and each build their own
// GitHubPublisher. Each one owns a separate lazy "get or create the release", so each creates
// one, and the tag ends up with two. Retrying can't prevent that; it's a check-then-act race
// upstream, and the doubled "publishing" log line every release is it happening.
//
// But electron-publish only creates a release when the tag has none -- find an existing one and
// every publisher just returns it. So create it here first and both publishers take that path.
// Has to happen shortly before the upload: electron-publish refuses to add assets to a release
// published more than 2h ago (set EP_GH_IGNORE_TIME=true if a slow retry ever trips that).
async function ensureRelease() {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
    headers
  })
  if (res.ok && (await res.json()).some((r) => r.tag_name === tag)) return

  const prerelease = !isLiveRelease(args)
  const created = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tag_name: tag, name: pkg.version, prerelease })
  })
  if (!created.ok) {
    // Most likely the tag isn't pushed yet -- GitHub rejects a non-draft release without one.
    console.error(`\nRefusing to publish: could not create release ${tag} (${created.status}).`)
    console.error(`${(await created.text()).slice(0, 300)}\n`)
    console.error(`Push the tag first:  git tag ${tag} && git push origin ${tag}\n`)
    process.exit(1)
  }
  console.error(`Created ${prerelease ? 'prerelease' : 'release'} ${tag} up front (race guard).\n`)
}

function runBuild() {
  // Kept as a backstop for transient upload failures (the installer is ~110MB); electron-builder
  // is idempotent here -- on a re-run it reuses the release and uploads only what's missing.
  try {
    execSync(cmd, { stdio: 'inherit' })
  } catch {
    console.error('\nPublish failed -- retrying once...\n')
    execSync(cmd, { stdio: 'inherit' })
  }
}

// Kept as a backstop even with ensureRelease() above: GitHub's release list is eventually
// consistent, so a publisher can still miss a release created moments earlier and create its own.
// When that happens there's no error at all -- the assets just split across two releases on the
// same tag (one holds latest.yml + the installer, the other only the blockmap), and tills fail
// their update check on whichever incomplete one they hit. Keep the release with the most assets
// (the complete one) and delete the rest.
async function cleanupDuplicateReleases() {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers })
  if (!res.ok) return
  const releases = (await res.json()).filter((r) => r.tag_name === tag)
  if (releases.length <= 1) return

  releases.sort((a, b) => b.assets.length - a.assets.length)
  const [keep, ...duplicates] = releases
  console.error(
    `\nFound ${releases.length} releases for tag ${tag} (concurrent-release race) -- keeping id=${keep.id} (${keep.assets.length} assets), merging in any assets missing from it...\n`
  )

  // The race can split assets across releases with no error at all -- e.g. one release gets
  // {latest.yml, exe}, the other gets only {blockmap}. Picking the release with "most assets"
  // isn't enough on its own: if that one is still missing the blockmap, deleting the other
  // silently throws away the only copy of it, breaking differential downloads for anyone
  // updating from this version. Copy over anything `keep` doesn't already have before deleting.
  const keepNames = new Set(keep.assets.map((a) => a.name))
  for (const dup of duplicates) {
    for (const asset of dup.assets) {
      if (keepNames.has(asset.name)) continue
      console.error(`Recovering ${asset.name} from duplicate release id=${dup.id} (missing from kept release)...`)
      const assetRes = await fetch(asset.url, { headers: { ...headers, Accept: 'application/octet-stream' } })
      const buf = Buffer.from(await assetRes.arrayBuffer())
      const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${keep.id}/assets?name=${encodeURIComponent(asset.name)}`
      await fetch(uploadUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
        body: buf
      })
      keepNames.add(asset.name)
    }
  }

  for (const dup of duplicates) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${dup.id}`, { method: 'DELETE', headers })
    console.error(`Deleted duplicate release id=${dup.id} (${dup.assets.length} assets)`)
  }
}

async function main() {
  if (!process.env.GH_TOKEN) {
    console.error('\nRefusing to publish: GH_TOKEN is not set.\n')
    console.error('electron-builder needs it to create/update the GitHub release. Set it first:\n')
    console.error('  PowerShell:  $env:GH_TOKEN="ghp_..."; npm run release\n')
    process.exit(1)
  }
  await ensureRelease()
  runBuild()
  await cleanupDuplicateReleases().catch((err) =>
    console.error('\nDuplicate-release cleanup failed:', err.message)
  )
}

// Guarded so the test can import ensureRelease/isLiveRelease without publishing anything.
if (require.main === module) main()

module.exports = { ensureRelease, isLiveRelease }
