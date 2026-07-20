import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

// Fills process.env from .env for local/manual builds; a real shell-exported var (e.g. in CI)
// always wins, and a missing .env (fresh clone, since it's gitignored) is fine too. Needed so
// the `define` block below — which freezes these into the bundle — sees them at all.
try {
  process.loadEnvFile()
} catch {}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      // A packaged main process reads the *user's* environment at runtime, not the build
      // machine's, so this has to be frozen into the bundle here or production resolves it to
      // nothing. `npm run dist`/`release` refuse to package when it's unset.
      'process.env.LICENSE_API_URL': JSON.stringify(process.env.LICENSE_API_URL ?? ''),
      // Admin-only cloud backup destination, not exposed in the Settings UI -- same
      // build-time-freeze reasoning as LICENSE_API_URL above, but optional (unset just means
      // the monthly Supabase upload no-ops).
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL ?? ''),
      'process.env.SUPABASE_SERVICE_KEY': JSON.stringify(process.env.SUPABASE_SERVICE_KEY ?? '')
    },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    root: 'src/renderer',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
