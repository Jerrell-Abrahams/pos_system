// better-sqlite3 here is built against Electron's ABI, not plain Node's (see rebuild-native.js),
// so tests that touch the database must run through Electron's bundled Node runtime instead.
const { spawnSync } = require('child_process')
const { join } = require('path')

const electronBin = join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
const vitestEntry = join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs')

const result = spawnSync(electronBin, [vitestEntry, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})

process.exit(result.status ?? 1)
