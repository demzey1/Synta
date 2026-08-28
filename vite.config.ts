import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Chrome extension build with multiple entry points and stable filenames
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        contentScript: 'src/contentScript.ts',
        background: 'src/background/index.ts',
      },
      output: {
        // Stable filenames so manifest.json doesn't break between builds
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.html')) return '[name].[ext]';
          return 'assets/[name].[ext]';
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    target: ['chrome100'],
  }
});
