import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { seo } from './seo-plugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), seo(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL ?? '')],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    clearMocks: true,
  },
}))
