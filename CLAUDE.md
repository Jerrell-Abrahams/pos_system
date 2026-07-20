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
- Bumping the version is safe to do without asking. **Never run
  `npm run release` (or anything that publishes) without explicit
  confirmation first** — it creates a public GitHub Release and pushes an
  update to every till running the app.
  - Exception: if the user's request to commit also explicitly says to
    ship/release (e.g. "commit and ship this", "commit and release"), that
    counts as confirmation — bump the version, commit, then run
    `npm run release` in the same turn without asking again.
  - Routine commits with no ship/release wording stay commit-only. Don't
    infer intent to release from context; require the explicit word.
