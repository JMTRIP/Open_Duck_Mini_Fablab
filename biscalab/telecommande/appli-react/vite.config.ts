import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Navigateurs garantis : iOS 16.4+ et Chrome 111+ (exigence de Tailwind 4).
// Le code est ramené jusqu'à iOS 15 et Chrome 99 pour laisser une chance aux téléphones plus anciens.
const NAVIGATEURS = ['es2020', 'safari15', 'ios15', 'chrome99', 'edge99', 'firefox100'];

// En développement (npm run dev), /ws est relayé vers le serveur du canard
// lancé à côté : python serveur/canard_serveur.py (port 8080).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: NAVIGATEURS,
    cssTarget: ['safari15', 'ios15', 'chrome99', 'edge99', 'firefox100'],
  },
});
