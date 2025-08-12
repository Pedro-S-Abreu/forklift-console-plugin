import { expect, type Page } from '@playwright/test';

import type { ProviderData } from '../../e2e/shared/test-data';

export class CreateProviderWizardPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async fillAndSubmit(testData: ProviderData) {
    // await this.page
    //   .locator('.pf-v5-c-card', {
    //     has: this.page.locator('.pf-v5-c-card__title-text', { hasText: testData.type }),
    //   })
    //   .click();
    await this.page
      .locator(
        'div:nth-child(5) > #selectable-card > .pf-v5-c-card__header > .pf-v5-c-card__actions > .pf-v5-c-card__selectable-actions > .pf-v5-c-radio > .pf-v5-c-radio__label',
      )
      .click();

    //fill name
    await this.page.getByRole('textbox', { name: 'Provider resource name' }).fill(testData.name);
    //fill url
    await this.page.getByRole('textbox', { name: 'URL' }).fill(testData.hostname);
    //fill vddk init image url
    if (testData.vddkInitImage) {
      await this.page
        .getByRole('textbox', { name: 'VDDK init image' })
        .fill(testData.vddkInitImage);
    }
    //fill username
    await this.page.getByRole('textbox', { name: 'Username' }).fill(testData.username);
    //fill password
    if (testData.password) {
      await this.page.getByRole('textbox', { name: 'Password input' }).fill(testData.password);
    }
    await this.page.locator('#insecureSkipVerify-off').click();
    await this.page.getByRole('button', { name: 'Create provider' }).click();
  }

  async waitForWizardLoad() {
    await expect(this.page.getByText('Create new provider')).toBeVisible();
  }
}
