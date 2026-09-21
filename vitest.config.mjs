import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.js',
        '**/*.config.mjs'
      ]
    }
  }
})