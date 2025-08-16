import type { Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(baseURL: string, username: string, password?: string) {
    await this.page.goto(baseURL);

    // Wait for the login form to be available
    await this.page.waitForSelector('#co-login-form', { timeout: 30000 });

    // Fill username
    await this.page.fill('#inputUsername', username);

    // Fill password if provided
    if (password) {
      await this.page.fill('#inputPassword', password);
    }

    // Wait for the login button to be enabled and click it
    await this.page.waitForFunction(
      () => {
        const button = document.querySelector('#co-login-button')!;
        return button && !(button as HTMLButtonElement).disabled;
      },
      { timeout: 10000 },
    );

    await this.page.click('#co-login-button');

    // Wait for successful login and redirect to console
    await this.page.waitForURL(/\/(?:dashboards|console|k8s|overview)/, { timeout: 30000 });
  }
}
