import type { Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(baseURL: string, username: string, password?: string) {
    console.error(`🌐 Navigating to: ${baseURL}`);
    await this.page.goto(baseURL);

    // Wait for the page to fully load by checking for the app div to be populated
    console.error('⏳ Waiting for page to load...');
    await this.page.waitForFunction(
      () => {
        const appDiv = document.getElementById('app');
        return appDiv && appDiv.children.length > 0;
      },
      { timeout: 30000 }
    );

    // Check if we're already on a login page or need to navigate to login
    const currentURL = this.page.url();
    console.error(`📍 Current URL: ${currentURL}`);
    
    // If the page redirects to auth/login, wait for it
    if (currentURL.includes('/auth/login')) {
      console.error('🔐 Already on login page');
    } else {
      console.error('🔄 Checking for login redirect...');
      try {
        // Wait a bit to see if we get redirected to login
        await this.page.waitForURL(/\/auth\/login/, { timeout: 10000 });
      } catch (error) {
        // If no redirect happens, try to find a login button or link
        console.error('🔗 No automatic redirect, looking for login link...');
        const loginButton = this.page.locator('button, a').filter({ hasText: /log\s*in/i }).first();
        if (await loginButton.isVisible({ timeout: 5000 })) {
          await loginButton.click();
          await this.page.waitForURL(/\/auth\/login/, { timeout: 15000 });
        }
      }
    }

    console.error('🔍 Looking for username field...');
    // Try different selectors for username field with a reasonable timeout
    const usernameSelector = this.page.locator('input[name="username"], #inputUsername, input[type="text"]').first();
    await usernameSelector.waitFor({ timeout: 15000 });
    await usernameSelector.fill(username);
    console.error('✅ Username filled');

    // Try different selectors for password field
    if (password) {
      console.error('🔍 Looking for password field...');
      const passwordSelector = this.page.locator('input[name="password"], #inputPassword, input[type="password"]').first();
      await passwordSelector.waitFor({ timeout: 10000 });
      await passwordSelector.fill(password);
      console.error('✅ Password filled');
    }

    // Submit the form
    console.error('🚀 Submitting login form...');
    const submitButton = this.page.locator('button[type="submit"], input[type="submit"], button').filter({ hasText: /log\s*in|submit|sign\s*in/i }).first();
    await submitButton.click();

    // Wait for redirect to console (dashboard or any authenticated page)
    console.error('⏳ Waiting for successful login redirect...');
    await this.page.waitForURL(/\/(?:dashboards|console|k8s|overview)/, { timeout: 30000 });
    console.error('✅ Login redirect successful');
  }
}
