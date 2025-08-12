import type { Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(baseURL: string, username: string, password?: string) {
    await this.page.goto(baseURL);

    // Try different selectors for username field
    const usernameSelector = this.page.locator('input[name="username"], #inputUsername').first();
    await usernameSelector.fill(username);

    // Try different selectors for password field
    if (password) {
      const passwordSelector = this.page.locator('input[name="password"], #inputPassword').first();
      await passwordSelector.fill(password);
    }

    // Submit the form
    await this.page.locator('button[type="submit"]').click();

    // Wait for redirect to console (dashboard or any authenticated page)
    await this.page.waitForURL(/\/(?:dashboards|console|k8s)/, { timeout: 30000 });
  }
}
