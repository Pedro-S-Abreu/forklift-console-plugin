/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { expect, type Page } from '@playwright/test';

import type { ProviderData } from '../../e2e/shared/test-data';

export class CreateProviderWizardPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async fillAndSubmit(testData: ProviderData) {
    const {
      name = '',
      endpointType = 'vcenter',
      hostname = '',
      username = '',
      password = '',
      vddkInitImage = '',
    } = testData;

    // await this.page
    //   .locator('.pf-v5-c-card', {
    //     has: this.page.locator('.pf-v5-c-card__title-text', { hasText: type }),
    //   })
    //   .click();
    //click o vsphere
    await this.page
      .locator(
        'div:nth-child(5) > #selectable-card > .pf-v5-c-card__header > .pf-v5-c-card__actions > .pf-v5-c-card__selectable-actions > .pf-v5-c-radio > .pf-v5-c-radio__label',
      )
      .click();

    //fill name
    await this.page.getByRole('textbox', { name: 'Provider resource name' }).fill(name);

    // Select SDK endpoint based on endpointType
    await this.page.locator(`input[name="sdkEndpoint"][id="sdkEndpoint-${endpointType}"]`).click();

    //fill url
    await this.page.getByRole('textbox', { name: 'URL' }).fill(hostname);
    //fill vddk init image url
    if (vddkInitImage) {
      await this.page.getByRole('textbox', { name: 'VDDK init image' }).fill(vddkInitImage);
    }
    //fill username
    await this.page.getByRole('textbox', { name: 'Username' }).fill(username);
    //fill password
    if (password) {
      await this.page.getByRole('textbox', { name: 'Password input' }).fill(password);
    }
    await this.page.locator('#insecureSkipVerify-off').click();
    await this.page.getByRole('button', { name: 'Create provider' }).click();
    await this.page.waitForTimeout(1000);
  }

  async waitForWizardLoad() {
    await expect(this.page.getByText('Create new provider')).toBeVisible();
  }
}
