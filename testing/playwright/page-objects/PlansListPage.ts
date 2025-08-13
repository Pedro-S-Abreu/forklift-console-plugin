import { expect, type Page } from '@playwright/test';

import { disableGuidedTour, waitForLoader } from '../utils/utils';

export class PlansListPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async assertCreatePlanButtonEnabled() {
    await expect(this.createPlanButton).toBeVisible();
    await expect(this.createPlanButton).toBeEnabled();
    await expect(this.createPlanButton).not.toHaveAttribute('aria-disabled', 'true');
  }

  async clickCreatePlanButton() {
    await this.assertCreatePlanButtonEnabled();
    await this.createPlanButton.click();
  }

  get createPlanButton() {
    return this.page.getByTestId('create-plan-button');
  }

  async navigateFromMainMenu() {
    // eslint-disable-next-line no-console
    console.log(`Navigating to /`);
    try {
      const response = await this.page.goto('/');
      // eslint-disable-next-line no-console
      console.log(`Navigation to / completed.`);
      if (response) {
        // eslint-disable-next-line no-console
        console.log(`Response status: ${response.status()}`);
        const isOk = response.ok();
        // eslint-disable-next-line no-console
        console.log(`Response ok: ${isOk}`);
        if (!isOk) {
          // eslint-disable-next-line no-console
          console.log(`Response text: ${await response.text()}`);
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('No response from page.goto("/")');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Error navigating to /: ${e.message}`);
      // eslint-disable-next-line no-console
      console.error(e.stack);
      throw e;
    }

    await disableGuidedTour(this.page);
    await waitForLoader(this.page);
    await this.page.getByTestId('migration-nav-item').click();
    await this.page.getByTestId('plans-nav-item').click();

    expect(this.page.url()).toContain('forklift.konveyor.io~v1beta1~Plan');
  }

  async waitForPageLoad() {
    await expect(this.page.getByRole('grid', { name: 'Migration plans' })).toBeVisible();
  }
}
