import * as fs from 'fs';
import * as path from 'path';

import { chromium, type FullConfig } from '@playwright/test';

import { LoginPage } from './page-objects/LoginPage';

const authFile = 'playwright/.auth/user.json';

const globalSetup = async function globalSetup(config: FullConfig) {
  const needsAuth = process.env.CLUSTER_USERNAME && process.env.CLUSTER_PASSWORD;

  if (!needsAuth) {
    return;
  }

  const { baseURL, headless, ignoreHTTPSErrors, video, viewport } = config.projects[0].use;
  const browser = await chromium.launch({ headless });

  // Enable video recording for setup, mirroring the project config
  const context = await browser.newContext({
    ignoreHTTPSErrors,
    recordVideo: video
      ? {
          dir: './test-results/', // Save videos in the standard output directory
          size: viewport, // Use viewport from config for video size
        }
      : undefined,
  });

  const page = await context.newPage();

  const username = process.env.CLUSTER_USERNAME;
  const password = process.env.CLUSTER_PASSWORD;

  try {
    const loginPage = new LoginPage(page);
    await loginPage.login(baseURL, username, password);

    const authDir = path.dirname(authFile);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    await page.context().storageState({ path: authFile });
    // eslint-disable-next-line no-console
    console.log('✅ Authentication successful');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('❌ Authentication failed:', (error as Error).message);

    // Take a debug screenshot
    await page.screenshot({
      path: './test-results/auth-failure-debug.png',
      fullPage: true,
    });

    throw error; // Re-throw to fail the setup
  } finally {
    await context.close(); // This will save the video if recording was enabled
    await browser.close();
  }
};

export default globalSetup;
