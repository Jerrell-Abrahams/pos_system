# Versioning & releases

This app auto-updates via `electron-updater`, which checks GitHub Releases
against the `version` field in `package.json`. Installed copies only update
if that number goes up — a merged change with no version bump ships to
nobody.

- After making a user-facing change (bug fix, new feature, behavior change),
  bump `version` in `package.json` following semver:
  - patch (`0.1.0` → `0.1.1`): bug fixes, no behavior/API change
  - minor (`0.1.0` → `0.2.0`): new feature, backwards-compatible
  - major (`0.1.0` → `1.0.0`): breaking change (data migration, removed
    feature, changed workflow cashiers rely on)
- Skip the bump for changes with no runtime effect: refactors, tests, docs,
  tooling, config.
- Bumping the version is safe to do without asking.
- Before running either release script below, the git tag matching the new
  version must already exist and be pushed: `git tag vX.Y.Z && git push
  origin vX.Y.Z`. GitHub's API rejects creating a non-draft release against
  a tag that doesn't exist yet (`422 Unprocessable Entity: Published
  releases must have a valid tag`) — both scripts below publish non-draft
  releases, so this always applies.
- Releasing has two flavors. **Never run either without explicit
  confirmation first**, each time, for that specific release:
  - `npm run release` — the default. Publishes a GitHub **prerelease**,
    which `electron-updater` ignores on every installed till (its
    `allowPrerelease` stays off unless the installed version's own semver
    has a prerelease component, which ours never do). This stages a build
    with zero effect on any tenant until explicitly promoted.
  - `npm run release:instant` — publishes a real, immediately-visible
    release. Every connected till picks it up on its next periodic check
    (or app restart) with no further action — this is the one that
    actually reaches tenants.
  - To promote an already-staged prerelease to live later: flip it on
    GitHub (release page → Edit → uncheck "Set as a pre-release"), or via
    the API (`PATCH /repos/.../releases/{id}` with `{"prerelease":
    false}`). Treat this the same as `release:instant` — it needs the same
    explicit go-ahead, since it's equally a "make this live to real
    tenants" action.
  - Exception: if the user's request to commit also explicitly says to
    ship/release (e.g. "commit and ship this", "commit and release"), that
    counts as confirmation to bump the version, commit, and run
    `npm run release` (staged) in the same turn without asking again.
    Actually reaching tenants — `release:instant`, or promoting a staged
    prerelease — always needs its own explicit word, separate from a
    routine "release" confirmation.
  - Routine commits with no ship/release wording stay commit-only. Don't
    infer intent to release from context; require the explicit word.
