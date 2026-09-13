import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  server: { port: 5173, fs: { allow: ['../..'] } },
  optimizeDeps: { exclude: ['@truco/rules'] },
  ssr: { noExternal: ['@threlte/core'] },
  // dssoca@0.17 vanilla.css tem `:where(:scope)a.ss-svc` — o lightningcss (minificador do Vite 8) rejeita; CSS fica sem minificar até isso ser corrigido no dssoca
  build: { cssMinify: false },
});
