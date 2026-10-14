/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { execSync } from 'child_process'

// Get git commit hash for build ID
let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Could not get git commit hash for build ID')
}

// Get build timestamp
const buildTime = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  assetsInclude: ['**/*.xml'],
  server: {
    port: 3000,
    host: true,
  },
  build: {
        outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // put the maxgraph code in a dedicated file. It lets know the size the produced bundle in an external application and if tree shaking works
            maxgraph: ['@maxgraph/core'],
          },
        },
      },
      chunkSizeWarningLimit: 367, // @maxgraph/core
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Playwright specs (tests/e2e) run with `npm run test:e2e`, never under vitest
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
    setupFiles: ['src/__tests__/setup.ts'],
    // Node >= 25 enables Web Storage by default and its global localStorage
    // (undefined without --localstorage-file) shadows jsdom's implementation.
    execArgv: ['--no-experimental-webstorage'],
    server: {
      deps: {
        // @maxgraph/core 0.10 ships ESM with extensionless relative imports that
        // Node's resolver rejects; let Vite transform it instead of externalizing.
        inline: ['@maxgraph/core'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/main.ts', 'src/legacy-main.ts', 'src/**/__tests__/**'],
    },
  },
})
