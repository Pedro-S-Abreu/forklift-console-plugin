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

  // eslint-disable-next-line no-console
  console.error(`🚀 Starting setup with baseURL: ${baseURL}`);
  // eslint-disable-next-line no-console
  console.error(`🔧 Environment: headless=${headless}, ignoreHTTPSErrors=${ignoreHTTPSErrors}`);

  const browserArgs = [
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--allow-running-insecure-content',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    // CSP bypass flags
    '--disable-features=VizDisplayCompositor,VizServiceDisplayCompositor',
    '--aggressive-cache-discard',
  ];

  // eslint-disable-next-line no-console
  console.error('🔧 Using browser args:', browserArgs.join(', '));

  const userDataDir = '/tmp/chrome-user-data';
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    // Add additional browser args for Jenkins environment
    args: browserArgs,
    ignoreHTTPSErrors: true, // Force this to true for Jenkins
    recordVideo: video
      ? {
          dir: './test-results/', // Save videos in the standard output directory
          size: viewport ?? undefined, // Use viewport from config for video size
        }
      : undefined,
    // Add extra context options for debugging
    extraHTTPHeaders: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  const page = await context.newPage();

  const username = process.env.CLUSTER_USERNAME;
  const password = process.env.CLUSTER_PASSWORD;

  try {
    if (!baseURL) {
      throw new Error(
        '`baseURL` is not defined in the Playwright config and is required for setup.',
      );
    }

    // eslint-disable-next-line no-console
    console.error(`🌐 Navigating to: ${baseURL}`);

    // Navigate with more debugging
    const response = await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // eslint-disable-next-line no-console
    console.error(`📄 Response status: ${response?.status()}`);
    // eslint-disable-next-line no-console
    console.error(`📄 Response URL: ${response?.url()}`);

    // Wait a bit for any redirects
    await page.waitForTimeout(3000);

    // Take screenshot of what we actually see
    await page.screenshot({
      path: './test-results/setup-page-loaded.png',
      fullPage: true,
    });

    // Log page details for debugging
    const title = await page.title();
    const url = page.url();
    // eslint-disable-next-line no-console
    console.error(`📄 Page title: "${title}"`);
    // eslint-disable-next-line no-console
    console.error(`📄 Current URL: ${url}`);

    // Check if page content is actually loaded
    const bodyText = await page.locator('body').textContent();
    // eslint-disable-next-line no-console
    console.error(`📄 Body text length: ${bodyText?.length ?? 0}`);
    // eslint-disable-next-line no-console
    console.error(`📄 First 200 chars: "${bodyText?.substring(0, 200) ?? 'No body text'}"`);

    // Check for any error messages on the page
    const errorElements = await page
      .locator('text=/error|Error|ERROR|failed|Failed|FAILED/i')
      .count();
    // eslint-disable-next-line no-console
    console.error(`🚨 Error elements found: ${errorElements}`);

    // Look for login elements before attempting login
    const usernameFields = await page
      .locator('input[type="text"], input[name="username"], #inputUsername')
      .count();
    const passwordFields = await page
      .locator('input[type="password"], input[name="password"], #inputPassword')
      .count();
    // eslint-disable-next-line no-console
    console.error(`🔍 Username fields found: ${usernameFields}`);
    // eslint-disable-next-line no-console
    console.error(`🔍 Password fields found: ${passwordFields}`);

    // List all input elements for debugging
    const allInputs = await page.locator('input').all();
    // eslint-disable-next-line no-console
    console.error(`🔍 Total input elements: ${allInputs.length}`);
    const inputDetails = await Promise.all(
      allInputs.map(async (input, i) => {
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        return `  Input ${i}: Type="${type}", Name="${name}", ID="${id}", Placeholder="${placeholder}"`;
      }),
    );
    // eslint-disable-next-line no-console
    console.error(inputDetails.join('\n'));

    // Check if we're on the right page (should contain login elements)
    if (usernameFields === 0 && passwordFields === 0) {
      // eslint-disable-next-line no-console
      console.error('⚠️ No login fields found - this might be a redirect or wrong page');

      // Check for common redirect patterns
      const loginLinks = await page
        .locator('a[href*="login"], a[href*="auth"], a[href*="oauth"]')
        .count();
      // eslint-disable-next-line no-console
      console.error(`🔗 Login-related links found: ${loginLinks}`);

      // Look for any buttons that might trigger authentication
      const buttons = await page.locator('button, input[type="submit"], a').all();
      // eslint-disable-next-line no-console
      console.error(`🔘 Buttons/links found: ${buttons.length}`);

      const buttonDetails = await Promise.all(
        buttons.slice(0, 5).map(async (button, i) => {
          const text = await button.textContent();
          const href = await button.getAttribute('href');
          return `  Button ${i}: "${text?.trim()}" href="${href}"`;
        }),
      );
      // eslint-disable-next-line no-console
      console.error(buttonDetails.join('\n'));
    }

    // If we have the right page, proceed with login
    if (usernameFields > 0 || passwordFields > 0) {
      const loginPage = new LoginPage(page);
      await loginPage.login(baseURL, username, password);

      const authDir = path.dirname(authFile);
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      await page.context().storageState({ path: authFile });
      // eslint-disable-next-line no-console
      console.error('✅ Authentication successful');
    } else {
      throw new Error('No login fields found on the page - this might not be the login page');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Authentication failed:', (error as Error).message);

    // Take comprehensive debugging screenshots
    await page.screenshot({
      path: './test-results/auth-failure-debug.png',
      fullPage: true,
    });

    // Also take a viewport screenshot for comparison
    await page.screenshot({
      path: './test-results/auth-failure-viewport.png',
      fullPage: false,
    });

    // Log final page state for debugging
    try {
      const finalTitle = await page.title();
      const finalUrl = page.url();
      const finalBodyText = await page.locator('body').textContent();
      // eslint-disable-next-line no-console
      console.error(`❌ Failed on page title: "${finalTitle}"`);
      // eslint-disable-next-line no-console
      console.error(`❌ Failed on URL: ${finalUrl}`);
      // eslint-disable-next-line no-console
      console.error(`❌ Final body text length: ${finalBodyText?.length ?? 0}`);
    } catch (debugError) {
      // eslint-disable-next-line no-console
      console.error('❌ Could not get final page state:', (debugError as Error).message);
    }

    throw error; // Re-throw to fail the setup
  } finally {
    await context.close(); // This will save the video if recording was enabled
  }
};

export default globalSetup;
