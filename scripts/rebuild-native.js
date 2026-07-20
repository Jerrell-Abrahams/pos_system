// Fetches better-sqlite3's prebuilt binary matched to the Electron ABI declared in
// package.json, instead of compiling from source (avoids needing Python/MSVC on Windows).
const { execFileSync } = require('child_process')
const { join } = require('path')

const electronVersion = require('electron/package.json').version
const moduleDir = join(__dirname, '..', 'node_modules', 'better-sqlite3')
const prebuildInstallBin = join(__dirname, '..', 'node_modules', 'prebuild-install', 'bin.js')

execFileSync(
  process.execPath,
  [prebuildInstallBin, '--runtime=electron', `--target=${electronVersion}`, '--arch=x64', '--platform=win32'],
  { cwd: moduleDir, stdio: 'inherit' }
)
