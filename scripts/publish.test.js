import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const { ensureRelease, isLiveRelease } = createRequire(import.meta.url)('./publish.js')

describe('isLiveRelease', () => {
  // The whole staged-vs-live distinction rides on this one string. A false negative stages a
  // release meant to go live (nobody gets it, and nothing errors); a false positive pushes an
  // unvetted build to every till on its next update check.
  it('is live only for the releaseType=release flavor', () => {
    expect(isLiveRelease(['--publish', 'always', '-c.publish.releaseType=release'])).toBe(true)
    expect(isLiveRelease(['--publish', 'always'])).toBe(false)
    expect(isLiveRelease(['--publish', 'always', '-c.publish.releaseType=prerelease'])).toBe(false)
  })
})

describe('ensureRelease', () => {
  // Needs a token and the network, so it only runs where those exist (i.e. the release machine).
  it.skipIf(!process.env.GH_TOKEN)(
    'is a no-op when the tag already has a release',
    async () => {
      // package.json's version is already released, so this must take the early-return path.
      // If it ever creates instead, the guard has stopped working and duplicates come back.
      const before = await listReleases()
      await ensureRelease()
      expect(await listReleases()).toEqual(before)
    },
    30000
  )
})

async function listReleases() {
  const pkg = createRequire(import.meta.url)('../package.json')
  const { owner, repo } = pkg.build.publish
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
    headers: {
      'User-Agent': 'pos-system-publish-test',
      Authorization: `token ${process.env.GH_TOKEN}`
    }
  })
  return (await res.json()).filter((r) => r.tag_name === `v${pkg.version}`).map((r) => r.id)
}
