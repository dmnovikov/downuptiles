import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/live', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] } },
  projects: [{ name: 'live-mobile-chrome', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } }],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
