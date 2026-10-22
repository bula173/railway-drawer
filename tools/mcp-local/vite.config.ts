/**
 * Build of the local MCP server (docs/AI.md): `npm run build:mcp-local` ->
 * tools/mcp-local/dist/railway-drawer-mcp.mjs (+ chunks). App modules and the MCP SDK are bundled;
 * `ws` and `jsdom` stay external (resolved from the repository's node_modules).
 */
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  logLevel: 'warn',
  define: {
    'import.meta.env.BASE_URL': JSON.stringify('/'),
  },
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node20',
    sourcemap: false,
    minify: false,
    rollupOptions: {
      external: ['ws', 'jsdom', /^node:/],
      output: { entryFileNames: 'railway-drawer-mcp.mjs', chunkFileNames: 'chunks/[name]-[hash].mjs', format: 'es' },
    },
  },
  ssr: {
    noExternal: true,
    external: ['ws', 'jsdom'],
  },
});
