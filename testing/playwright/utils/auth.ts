import type { Page } from '@playwright/test';

interface AuthCredentials {
  page: Page;
  username: string;
  password: string;
  baseUrl: string;
}

/**
 * Authenticate using username/password via OAuth
 */
export const authenticateWithCredentials = async ({
  page,
  username,
  password,
  baseUrl,
}: AuthCredentials) => {
  await page.goto(baseUrl);

  // Wait for login form and fill credentials
  await page.waitForSelector('input[name="username"], #inputUsername', { timeout: 10000 });

  // Try different selectors for username field
  const usernameSelector = page.locator('input[name="username"], #inputUsername').first();
  await usernameSelector.fill(username);

  // Try different selectors for password field
  const passwordSelector = page.locator('input[name="password"], #inputPassword').first();
  await passwordSelector.fill(password);

  // Submit the form
  await page.locator('button[type="submit"], input[type="submit"]').click();

  // Wait for redirect to console (dashboard or any authenticated page)
  await page.waitForURL(/\/(?:dashboards|console|k8s)/, { timeout: 30000 });
};

interface SetupAuthOptions {
  baseUrl: string;
  username?: string;
  password?: string;
}

/**
 * Setup authentication for tests
 * Uses username and password credentials
 */
export const setupAuthentication = async (page: Page, options: SetupAuthOptions) => {
  const { baseUrl, username, password } = options;

  if (!username || !password) {
    throw new Error('Username and password are required for authentication.');
  }

  await authenticateWithCredentials({
    page,
    username,
    password,
    baseUrl,
  });
};
