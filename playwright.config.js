// Testes de ponta a ponta. No CI roda em WebKit (o motor do Safari/iPhone) e Chromium (Android).
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', serviceWorkers: 'block' },
  webServer: { command: 'node tests/serve.mjs', url: 'http://127.0.0.1:4173', env: { E2E: '1' }, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } }
  ]
});
