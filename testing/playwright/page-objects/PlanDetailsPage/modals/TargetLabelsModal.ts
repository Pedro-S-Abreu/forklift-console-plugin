import { expect, type Locator, type Page } from '@playwright/test';

export class TargetLabelsModal {
  readonly cancelButton: Locator;
  readonly labelInput: Locator;
  readonly modal: Locator;
  protected readonly page: Page;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = this.page.getByTestId('labels-modal');
    this.saveButton = this.page.getByTestId('modal-confirm-button');
    this.cancelButton = this.page.getByTestId('modal-cancel-button');
    // The labels modal uses a textbox with role="textbox"
    this.labelInput = this.modal.getByRole('textbox');
  }

  async addLabel(key: string, value: string): Promise<void> {
    // Type the label in key=value format and press Enter
    await this.labelInput.fill(`${key}=${value}`);
    await this.labelInput.press('Enter');
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForModalToClose();
  }

  async deleteLabelByKey(key: string): Promise<void> {
    // Find the PatternFly label component containing the key
    const label = this.modal.locator('.pf-v5-c-label').filter({ hasText: key });
    // Click the close button within the label
    const closeButton = label.getByRole('button', { name: new RegExp(`Close ${key}`, 'i') });
    await closeButton.click();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.waitForModalToClose();
  }

  async verifyLabelExists(key: string, value: string): Promise<void> {
    const labelText = `${key}=${value}`;
    // Labels are displayed as PatternFly label components
    const label = this.modal.locator('.pf-v5-c-label').filter({ hasText: labelText });
    await expect(label).toBeVisible();
  }

  async verifySaveButtonEnabled(shouldBeEnabled = true): Promise<void> {
    if (shouldBeEnabled) {
      await expect(this.saveButton).toBeEnabled();
    } else {
      await expect(this.saveButton).toBeDisabled();
    }
  }

  async waitForModalToClose(): Promise<void> {
    await expect(this.modal).not.toBeVisible();
  }

  async waitForModalToOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }
}
