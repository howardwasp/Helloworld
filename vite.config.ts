import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Project site on GitHub Pages: https://howardwasp.github.io/Helloworld/
// Dev keeps `/` so `npm run dev` still matches the README local URL.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Helloworld/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
}))
