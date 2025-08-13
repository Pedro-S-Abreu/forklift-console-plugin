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

  // More aggressive browser args for Jenkins CI environment
  const browserArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-software-rasterizer',
    '--disable-features=VizDisplayCompositor,TranslateUI,BlinkGenPropertyTrees',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-background-networking',
    '--disable-ipc-flooding-protection',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--allow-running-insecure-content',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--ignore-certificate-errors-spki-list',
    '--ignore-urlfetcher-cert-requests',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-cloud-import',
    '--disable-gesture-typing',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-speech-api',
    '--hide-scrollbars',
    '--mute-audio',
    '--disable-logging',
    '--disable-gl-drawing-for-tests',
    '--disable-canvas-aa',
    '--disable-3d-apis',
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-jpeg-decoding',
    '--disable-accelerated-mjpeg-decode',
    '--disable-app-list-dismiss-on-blur',
    '--disable-accelerated-video-decode',
    '--num-raster-threads=1',
    '--enable-viewport',
    '--disable-partial-raster',
    '--disable-rgbaa-heuristics',
    '--disable-skia-runtime-opts',
    '--in-process-gpu',
    '--disable-low-res-tiling',
    '--enable-experimental-web-platform-features',
    '--js-flags=--expose-gc',
  ];

  // eslint-disable-next-line no-console
  console.error('🔧 Using browser args:', browserArgs.join(', '));

  const browser = await chromium.launch({
    headless,
    args: browserArgs,
  });

  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
    // In CI/headless environments CSP can prevent inline scripts from executing,
    // which results in the OpenShift console showing the fallback <noscript> content.
    // Bypass CSP so the SPA can boot even under strict headers.
    bypassCSP: true,
    acceptDownloads: true,
    recordVideo: video
      ? {
          dir: './test-results/',
          size: viewport ?? undefined,
        }
      : undefined,
  });

  const page = await context.newPage();

  const username = process.env.CLUSTER_USERNAME;
  const password = process.env.CLUSTER_PASSWORD;

  try {
    if (!baseURL) {
      throw new Error('`baseURL` is not defined in the Playwright config and is required for setup.');
    }

    // eslint-disable-next-line no-console
    console.error(`🌐 Navigating to: ${baseURL}`);
    
    // Navigate with more debugging
    const response = await page.goto(baseURL, { 
      waitUntil: 'networkidle',
      timeout: 60000 
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
      fullPage: true 
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
    console.error(`📄 Body text length: ${bodyText?.length || 0}`);
    // eslint-disable-next-line no-console
    console.error(`📄 First 200 chars: "${bodyText?.substring(0, 200) || 'No body text'}"`);
    
    // Check for any error messages on the page
    const errorElements = await page.locator('text=/error|Error|ERROR|failed|Failed|FAILED/i').count();
    // eslint-disable-next-line no-console
    console.error(`🚨 Error elements found: ${errorElements}`);
    
    // Look for login elements before attempting login
    const usernameFields = await page.locator('input[type="text"], input[name="username"], #inputUsername').count();
    const passwordFields = await page.locator('input[type="password"], input[name="password"], #inputPassword').count();
    // eslint-disable-next-line no-console
    console.error(`🔍 Username fields found: ${usernameFields}`);
    // eslint-disable-next-line no-console
    console.error(`🔍 Password fields found: ${passwordFields}`);
    
    // List all input elements for debugging
    const allInputs = await page.locator('input').all();
    // eslint-disable-next-line no-console
    console.error(`🔍 Total input elements: ${allInputs.length}`);
    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      // eslint-disable-next-line no-console
      console.error(
        `  Input ${i}: Type="${type}", Name="${name}", ID="${id}", Placeholder="${placeholder}"`,
      );
    }
    
    // Check if we're on the right page (should contain login elements)
    if (usernameFields === 0 && passwordFields === 0) {
      // eslint-disable-next-line no-console
      console.error('⚠️ No login fields found - this might be a redirect or wrong page');

      // If we landed on the SPA root without JS executing (e.g., headless CI), the body
      // will often contain the fallback message. In that case, go straight to server-side
      // auth endpoint that issues a 302 to the cluster OAuth login page (no JS required).
      const bodyTextSnapshot = (await page.locator('body').textContent()) || '';
      if (/javascript must be enabled\.?/i.test(bodyTextSnapshot)) {
        // eslint-disable-next-line no-console
        console.error('🔁 Detected noscript fallback. Navigating directly to /auth/login to trigger OAuth redirect.');
        const authLoginUrl = `${baseURL?.replace(/\/?$/, '')}/auth/login`;
        const authResp = await page.goto(authLoginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // eslint-disable-next-line no-console
        console.error(`📎 /auth/login response: ${authResp?.status()} ${authResp?.url()}`);
        await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => undefined);

        // Re-evaluate login fields after redirect
        const recheckUsername = await page.locator('input[type="text"], input[name="username"], #inputUsername').count();
        const recheckPassword = await page.locator('input[type="password"], input[name="password"], #inputPassword').count();
        // eslint-disable-next-line no-console
        console.error(`🔍 (After /auth/login) Username fields: ${recheckUsername}, Password fields: ${recheckPassword}`);
      }

      // Check for common redirect patterns
      const loginLinks = await page.locator('a[href*="login"], a[href*="auth"], a[href*="oauth"]').count();
      // eslint-disable-next-line no-console
      console.error(`🔗 Login-related links found: ${loginLinks}`);

      // Look for any buttons that might trigger authentication
      const buttons = await page.locator('button, input[type="submit"], a').all();
      // eslint-disable-next-line no-console
      console.error(`🔘 Buttons/links found: ${buttons.length}`);
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        const button = buttons[i];
        const text = await button.textContent();
        const href = await button.getAttribute('href');
        // eslint-disable-next-line no-console
        console.error(`  Button ${i}: "${text?.trim()}" href="${href}` + '"');
      }
    }

    // If we have the right page, proceed with login
    if (usernameFields > 0 || passwordFields > 0) {
      if (!username || !password) {
        throw new Error('Username and password must be provided');
      }
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
      console.error(`❌ Final body text length: ${finalBodyText?.length || 0}`);
    } catch (debugError) {
      // eslint-disable-next-line no-console
      console.error('❌ Could not get final page state:', (debugError as Error).message);
    }

    throw error; // Re-throw to fail the setup
  } finally {
    await context.close(); // This will save the video if recording was enabled
    await browser.close();
  }
};

export default globalSetup;