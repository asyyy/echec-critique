import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests de la logique (stores, export, règles) : pas de rendu de composants, pas de navigateur
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    // Node ≥ 25 expose un localStorage expérimental : on le coupe, setup.ts fournit le sien
    execArgv: ['--no-experimental-webstorage'],
  },
})
