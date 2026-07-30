import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/railway-drawer/' : '/',
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
})



