import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/web', timeout: 60000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3298', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: 'node dist/web/main.js', url: 'http://127.0.0.1:3298/healthz', env: { PORT: '3298', APP_MODE: 'local', APP_ORIGIN: 'http://127.0.0.1:3298' }, reuseExistingServer: false },
  reporter: 'list'
});
