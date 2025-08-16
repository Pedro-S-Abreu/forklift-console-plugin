import type { Page } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async login(baseURL: string, username: string, password?: string) {
    console.log('🌐 Navigating to:', baseURL);
    
    try {
      const response = await this.page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 });
      console.log('📊 Response status:', response?.status());
      console.log('📍 Final URL after redirects:', this.page.url());
      console.log('📄 Page title:', await this.page.title());
      
      // Take screenshot for visual debugging
      await this.page.screenshot({ path: 'debug-page-load.png', fullPage: true });
      
      // Check what's actually on the page
      const pageContent = await this.page.content();
      console.log('📜 Page HTML length:', pageContent.length);
      
      // Look for login-related elements
      const hasLoginForm = await this.page.locator('#co-login-form').count();
      const hasUsernameInput = await this.page.locator('#inputUsername').count();
      const hasPasswordInput = await this.page.locator('#inputPassword').count();
      const hasLoginButton = await this.page.locator('#co-login-button').count();
      
      console.log('🔍 Login elements found:');
      console.log('  - #co-login-form:', hasLoginForm);
      console.log('  - #inputUsername:', hasUsernameInput);
      console.log('  - #inputPassword:', hasPasswordInput);
      console.log('  - #co-login-button:', hasLoginButton);
      
      // Check for common error indicators
      const errorElements = await this.page.locator('text=/error|Error|ERROR/').count();
      const forbiddenElements = await this.page.locator('text=/forbidden|Forbidden|403/').count();
      const notFoundElements = await this.page.locator('text=/not found|Not Found|404/').count();
      
      if (errorElements > 0 || forbiddenElements > 0 || notFoundElements > 0) {
        console.log('🚨 Error indicators found:', { errorElements, forbiddenElements, notFoundElements });
        const bodyText = await this.page.textContent('body');
        console.log('📄 Page text content:', bodyText?.slice(0, 1000));
      }
      
      // Check for alternative login forms or auth providers
      const alternativeLogins = await this.page.locator('form, [class*="login"], [class*="auth"], [id*="login"], [id*="auth"]').count();
      console.log('🔀 Alternative login elements found:', alternativeLogins);
      
    } catch (error) {
      console.error('🚨 Navigation failed:', error);
      await this.page.screenshot({ path: 'debug-navigation-error.png', fullPage: true });
      throw error;
    }

    // Wait for the login form to be available
    console.log('⏳ Waiting for #co-login-form...');
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
