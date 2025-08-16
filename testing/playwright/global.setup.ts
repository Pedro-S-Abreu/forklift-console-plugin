import { existsSync, unlinkSync } from 'fs';

import { chromium, type FullConfig } from '@playwright/test';

import { LoginPage } from './page-objects/LoginPage';
import { disableGuidedTour } from './utils/utils';

const RESOURCES_FILE = 'playwright/.resources.json';

const globalSetup = async (config: FullConfig) => {
  console.error('🚀 Starting global setup...');
  
  if (existsSync(RESOURCES_FILE)) {
    console.error(`🗑️ Removing existing resources file: ${RESOURCES_FILE}`);
    unlinkSync(RESOURCES_FILE);
  }

  const { baseURL, storageState } = config.projects[0].use;
  const username = process.env.CLUSTER_USERNAME;
  const password = process.env.CLUSTER_PASSWORD;

  console.error(`🔧 Configuration:`);
  console.error(`   baseURL: ${baseURL}`);
  console.error(`   storageState: ${JSON.stringify(storageState)}`);
  console.error(`   username: ${username ? '***PROVIDED***' : 'NOT_PROVIDED'}`);
  console.error(`   password: ${password ? '***PROVIDED***' : 'NOT_PROVIDED'}`);

  if (!baseURL) {
    throw new Error('baseURL is not defined in the Playwright config');
  }

  if (username && password) {
    console.error('🌐 Launching browser for authentication...');
    const browser = await chromium.launch();
    const page = await browser.newPage({ ignoreHTTPSErrors: true });

    // Listen to all HTTP responses for debugging
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const statusText = response.statusText();
      
      console.error(`📡 HTTP Response: ${status} ${statusText} - ${url}`);
      
      // Log response body for failed requests or important endpoints
      if (status >= 400 || url.includes('/auth') || url.includes('/login') || url.includes('/oauth')) {
        try {
          const body = await response.text();
          console.error(`📄 Response body (${body.length} chars): ${body.substring(0, 500)}${body.length > 500 ? '...' : ''}`);
        } catch (error) {
          console.error(`❌ Failed to read response body: ${error}`);
        }
      }
    });

    // Listen to console messages from the page
    page.on('console', (msg) => {
      // console.error(`🖥️ Browser console [${msg.type()}]:`, msg.text());
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      console.error(`🚨 Page error: ${error.message}`);
    });

    console.error('🎭 Disabling guided tour...');
    await disableGuidedTour(page);

    try {
      console.error('🔐 Attempting login...');
      const loginPage = new LoginPage(page);
      console.error('📄 Page HTML before login:', await page.content());
      await loginPage.login(baseURL, username, password);
      console.error('✅ Login successful');

      console.error('💾 Saving authentication state...');
      await page.context().storageState({ path: storageState as string });
      console.error('✅ Authentication state saved');
    } catch (error) {
      console.error('❌ Login failed in global setup:', error);
      console.error('📄 Page HTML on login failure:', await page.content());
      // Re-throwing the error is important to make sure the test run fails
      // if the setup can't complete.
      throw error;
    } finally {
      console.error('🔒 Closing browser...');
      await browser.close();
      console.error('✅ Browser closed');
    }

    console.error('✅ Global setup completed successfully');
  } else {
    console.error('⚠️ No credentials provided, skipping authentication setup');
  }
};

export default globalSetup;
