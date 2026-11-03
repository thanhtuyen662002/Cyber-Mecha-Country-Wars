import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` makes one self-contained HTML file (handy for sharing a preview).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  // the single-file build is a shareable demo: simulated viewers on, no live connection
  define: { __DEMO__: JSON.stringify(mode === 'single') },
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', target: 'es2022' },
}));
