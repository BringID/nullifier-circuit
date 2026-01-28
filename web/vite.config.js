import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig({
  plugins: [topLevelAwait()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
    exclude: ['@aztec/bb.js', '@bringid/nullifier'],
  },
  resolve: {
    alias: {
      pino: 'pino/browser.js',
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: {
      // Allow serving files from the packages directory
      allow: [
        path.resolve(__dirname, '..'),
      ],
    },
  },
});
