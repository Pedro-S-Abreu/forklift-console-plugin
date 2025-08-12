import { expect, type Page } from '@playwright/test';

export class ProviderDetailsPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async verifyBasicProviderDetailsPage(providerData: { providerName: string }): Promise<void> {
    await this.waitForPageLoad(providerData.providerName);
    await this.verifyProviderDetails(providerData.providerName);
  }

  async verifyProviderDetails(providerName: string): Promise<void> {
    //TODO data-test-id
    //TODO check other data
    // Verify provider name
    //await this.page.pause();
    const titleLocator = this.page.locator('.pf-v5-l-split__item', {
      hasText: providerName,
    });
    await expect(titleLocator).toBeVisible({ timeout: 15000 });

    // Verify provider status
    const statusLocator = titleLocator.locator('[data-test="resource-status"]');
    await expect(statusLocator).toContainText('Ready');
  }

  async waitForPageLoad(providerName: string): Promise<void> {
    //TODO data-test-id
    await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    // await this.page.pause();
    // Using a locator that finds the title of the page.
    //verifyProviderDetails
    await this.verifyProviderDetails(providerName);
  }
}
