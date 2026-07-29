import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const require_ = createRequire(import.meta.url)
const { ensureRelease, isLiveRelease } = require_('./publish.js')
const pkg = require_('../package.json')

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

// Stubbed rather than hitting GitHub. This previously called the real ensureRelease() against the
// live API, guarded only by `skipIf(!GH_TOKEN)` -- but vitest loads .env, so the token is always
// present on a dev machine and the test always ran. Its premise ("package.json's version is
// already released, so this early-returns") only holds right after a release; on any bumped,
// not-yet-released version it took the *create* path instead and left a real empty prerelease
// behind. Three of those accumulated on the repo before anyone noticed.
describe('ensureRelease', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubGitHub(existingTags) {
    const methods = []
    vi.stubGlobal('fetch', async (_url, init) => {
      methods.push(init?.method ?? 'GET')
      return { ok: true, json: async () => existingTags.map((t) => ({ tag_name: t })) }
    })
    return methods
  }

  it('does not create when the tag already has a release', async () => {
    const methods = stubGitHub([`v${pkg.version}`])
    await ensureRelease()
    expect(methods).toEqual(['GET'])
  })

  // The guard failing open is what brought back duplicate releases on one tag.
  it('creates one when the tag has none', async () => {
    const methods = stubGitHub(['v0.0.0-nothing-like-ours'])
    await ensureRelease()
    expect(methods).toEqual(['GET', 'POST'])
  })
})
