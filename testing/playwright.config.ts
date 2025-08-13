import { defineConfig, devices } from '@playwright/test';
//const authFile = 'playwright/.auth/user.json';
//const needsAuth = process.env.CLUSTER_USERNAME && process.env.CLUSTER_PASSWORD;

export default defineConfig({
  testDir: './playwright/e2e',
  //globalSetup: require.resolve('./playwright/global.setup.ts'),
  timeout: 60_000,
  fullyParallel: true,

  retries: process.env.GITHUB_ACTIONS ? 3 : 0,

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        //storageState: needsAuth ? authFile : undefined,
        // GitHub Actions uses port 30080, local dev uses 9000
        baseURL:
          process.env.BRIDGE_BASE_ADDRESS ?? process.env.BASE_ADDRESS ?? 'http://localhost:9000',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // Use data-testid to match actual rendered HTML
        testIdAttribute: 'data-testid',
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        acceptDownloads: true,
      },
    },
  ],
});
