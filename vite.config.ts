import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/railway-drawer/' : '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
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



