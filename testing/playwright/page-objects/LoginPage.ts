import type { Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(baseURL: string, username: string, password?: string) {
    await this.page.goto(baseURL);

    // Wait for the page to fully load
    await this.page.waitForLoadState('networkidle', { timeout: 15000 });

    // Wait for the React app to start rendering
    try {
      await this.page.waitForFunction(
        () => {
          const appDiv = document.getElementById('app');
          if (!appDiv) return false;

          const hasContent =
            Array.from(appDiv.children).length > 0 || appDiv.textContent?.trim() !== '';
          const hasReactElements = document.querySelector(
            '[data-reactroot], [data-react-helmet], .pf-c-page, .pf-c-login, .co-',
          );

          return hasContent || hasReactElements;
        },
        { timeout: 20000 },
      );
    } catch (_error) {
      // Continue anyway - maybe the app loads differently than expected
    }

    // Check if we're already on a login page or need to navigate to login
    const currentURL = this.page.url();
    const hasLoginForm = await this.page
      .locator('form[action="/login"], #co-login-form, input[name="username"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!currentURL.includes('/auth/login') && !hasLoginForm) {
      try {
        await this.page.waitForURL(/\/auth\/login/, { timeout: 10000 });
      } catch (_error) {
        const loginLink = this.page
          .locator('a')
          .filter({ hasText: /log\s*in|sign\s*in/i })
          .first();
        if (await loginLink.isVisible({ timeout: 5000 })) {
          await loginLink.click();
          await this.page.waitForURL(/\/auth\/login/, { timeout: 15000 });
        }
      }
    }

    // Find and fill username field
    const usernameSelectors = [
      'input[name="username"]',
      '#inputUsername',
      'input[type="text"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="user" i]',
      '[data-testid*="username"]',
      '.pf-c-form-control[type="text"]',
    ];

    const findUsernameField = async () => {
      const results = await Promise.allSettled(
        usernameSelectors.map(async (selector) => {
          const element = this.page.locator(selector).first();
          const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
          return { element, isVisible };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.isVisible) {
          return result.value.element;
        }
      }
      return null;
    };

    let usernameSelector = await findUsernameField();

    if (!usernameSelector) {
      usernameSelector = this.page.locator('input:visible').first();
      await usernameSelector.waitFor({ timeout: 15000 });
    }

    await usernameSelector.fill(username);

    // Find and fill password field
    if (password) {
      const passwordSelectors = [
        'input[name="password"]',
        '#inputPassword',
        'input[type="password"]',
        'input[placeholder*="password" i]',
        '[data-testid*="password"]',
        '.pf-c-form-control[type="password"]',
      ];

      const findPasswordField = async () => {
        const results = await Promise.allSettled(
          passwordSelectors.map(async (selector) => {
            const element = this.page.locator(selector).first();
            const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
            return { element, isVisible };
          }),
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.isVisible) {
            return result.value.element;
          }
        }
        return null;
      };

      const passwordSelector = await findPasswordField();

      if (passwordSelector) {
        await passwordSelector.fill(password);
      }
    }

    // Submit the form
    const submitButton = this.page.locator('#co-login-button, button[type="submit"]').first();

    try {
      // Wait for button to be enabled (the JavaScript validates form and enables it)
      await this.page.waitForFunction(
        () => {
          const button = document.querySelector('#co-login-button, button[type="submit"]');
          return button && 'disabled' in button && !(button as HTMLButtonElement).disabled;
        },
        { timeout: 10000 },
      );

      await submitButton.click();
    } catch (_error) {
      // Alternative: try pressing Enter on password field
      try {
        await this.page.locator('#inputPassword, input[name="password"]').press('Enter');
      } catch (_altError) {
        await this.page.evaluate(() => {
          const form = document.querySelector('#co-login-form, form[action="/login"]');
          if (form && 'submit' in form) {
            (form as HTMLFormElement).submit();
          }
        });
      }
    }

    // Wait for redirect to console
    await this.page.waitForURL(/\/(?:dashboards|console|k8s|overview)/, { timeout: 30000 });
  }
}
