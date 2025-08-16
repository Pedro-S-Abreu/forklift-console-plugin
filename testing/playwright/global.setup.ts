import { existsSync, unlinkSync } from 'fs';

import { chromium, type FullConfig } from '@playwright/test';

import { LoginPage } from './page-objects/LoginPage';
import { disableGuidedTour } from './utils/utils';

const RESOURCES_FILE = 'playwright/.resources.json';

const globalSetup = async (config: FullConfig) => {
  if (existsSync(RESOURCES_FILE)) {
    unlinkSync(RESOURCES_FILE);
  }

  const { baseURL, storageState } = config.projects[0].use;
  const username = process.env.CLUSTER_USERNAME;
  const password = process.env.CLUSTER_PASSWORD;

  if (!baseURL) {
    throw new Error('baseURL is not defined in the Playwright config');
  }

  if (username && password) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ ignoreHTTPSErrors: true });

    await disableGuidedTour(page);

    const loginPage = new LoginPage(page);
    await loginPage.login(baseURL, username, password);
    await page.context().storageState({ path: storageState as string });
    await browser.close();
  }
};

export default globalSetup;
