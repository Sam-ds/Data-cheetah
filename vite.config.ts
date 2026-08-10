import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  // GitHub Pages serves under /Data-cheetah/; local `dev` / `preview` use `/`
  base: process.env.GITHUB_ACTIONS ? '/Data-cheetah/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: false,
          workbox: {
        // App shell + static assets. DuckDB .wasm is large — browser HTTP-caches hashed /assets/*.wasm
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,csv}'],
        globIgnores: ['**/web-llm-*.js', '**/*.wasm'],
        // Allow slightly larger app chunks; WebLLM is split out and ignored above
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Never treat Discover template / geo assets as SPA navigations
        navigateFallbackDenylist: [/^\/templates\//, /\/templates\//, /^\/geo\//, /\/geo\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        // GitHub Pages serves .ts as video/mp2t — workers must be .js
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/@mlc-ai/web-llm') || id.includes('node_modules/@mlc-ai')) {
            return 'web-llm'
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
})
