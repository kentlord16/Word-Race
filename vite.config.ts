import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works in Capacitor (file-ish origin),
// on GitHub Pages under /<repo>/, or at a domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The guess dictionary is one big chunk on purpose; it loads in the background.
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
});
