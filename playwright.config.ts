import { defineConfig, devices } from '@playwright/test';

const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1';
const adminAuthFile = 'playwright-artifacts/.auth/admin.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [/auth\.admin\.setup\.ts/, /admin-routes\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-setup',
      testMatch: /auth\.admin\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-chromium',
      testMatch: /admin-.*\.spec\.ts/,
      dependencies: ['admin-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
    },
    {
      name: 'user-chromium',
      testMatch: /user-.*\.spec\.ts/,
      dependencies: ['admin-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
    },
  ],
  webServer: useExistingServer ? undefined : {
    command: 'npm run dev:web',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
