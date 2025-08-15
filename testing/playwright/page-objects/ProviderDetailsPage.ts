import { expect, type Page } from '@playwright/test';

export class ProviderDetailsPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async verifyProviderDetails(providerData: {
    providerName: string;
    providerType?: string;
    providerUrl?: string;
    providerProject?: string;
    product?: string;
    credentials?: string;
    transferNetwork?: string;
    vddkInitImage?: string;
  }): Promise<void> {
    await expect(this.page.getByTestId('resource-details-title')).toContainText(
      providerData.providerName,
    );
    await expect(this.page.getByTestId('name-detail-item')).toContainText(
      providerData.providerName,
    );
    await expect(this.page.getByTestId('type-detail-item')).toContainText(
      providerData.providerType ?? '',
    );
    await expect(this.page.getByTestId('url-detail-item')).toContainText(
      providerData.providerUrl ?? '',
    );
    await expect(this.page.getByTestId('project-detail-item')).toContainText(
      providerData.providerProject ?? '',
    );
    await expect(this.page.getByTestId('product-detail-item')).toContainText(
      providerData.product ?? '',
    );
    await expect(this.page.getByTestId('credentials-detail-item')).toContainText(
      providerData.credentials ?? '',
    );
    await expect(this.page.getByTestId('vddk-detail-item')).toContainText(
      providerData.vddkInitImage ?? '',
    );
    await expect(this.page.getByTestId('created-at-detail-item')).toBeVisible();
    await expect(this.page.getByTestId('owner-detail-item')).toContainText('No owner');
    const statusLocator = this.page.locator('[data-test="resource-status"]');
    await expect(statusLocator).toContainText('Ready');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });

    // Wait for the provider details page to load by ensuring key elements are present
    await expect(this.page.getByTestId('name-detail-item')).toBeVisible({ timeout: 15000 });
  }
}
