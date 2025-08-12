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
  const { baseURL, headless, ignoreHTTPSErrors } = config.projects[0].use;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ ignoreHTTPSErrors });
  const page = await context.newPage();

  const username = process.env.CLUSTER_USERNAME;
  const password = process.env.CLUSTER_PASSWORD;

  const loginPage = new LoginPage(page);
  await loginPage.login(baseURL, username, password);

  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.context().storageState({ path: authFile });
  await browser.close();
};

export default globalSetup;
