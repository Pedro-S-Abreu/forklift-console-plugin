import { expect, type Locator, type Page } from '@playwright/test';

export class GuestConversionModal {
  readonly cancelButton: Locator;
  readonly modal: Locator;
  protected readonly page: Page;
  readonly saveButton: Locator;
  readonly skipGuestConversionCheckbox: Locator;
  readonly useCompatibilityModeCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = this.page.getByTestId('guest-conversion-mode-modal');
    this.skipGuestConversionCheckbox = this.page.getByTestId('skip-guest-conversion-checkbox');
    this.useCompatibilityModeCheckbox = this.page.getByTestId('use-compatibility-mode-checkbox');
    this.saveButton = this.page.getByTestId('modal-confirm-button');
    this.cancelButton = this.page.getByTestId('modal-cancel-button');
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForModalToClose();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.waitForModalToClose();
  }

  async toggleSkipGuestConversion(check: boolean): Promise<void> {
    if (check) {
      await this.skipGuestConversionCheckbox.check();
    } else {
      await this.skipGuestConversionCheckbox.uncheck();
    }
    await expect(this.skipGuestConversionCheckbox).toBeChecked({ checked: check });
  }

  async toggleUseCompatibilityMode(check: boolean): Promise<void> {
    if (check) {
      await this.useCompatibilityModeCheckbox.check();
    } else {
      await this.useCompatibilityModeCheckbox.uncheck();
    }
    await expect(this.useCompatibilityModeCheckbox).toBeChecked({ checked: check });
  }

  async verifyCompatibilityWarningMessage(): Promise<void> {
    const compatibilityWarningMessage = this.modal.getByText(
      /If you don't use compatibility mode, you must have VirtIO drivers already installed in the source VM./,
    );
    await expect(compatibilityWarningMessage).toBeVisible();
  }

  async verifySaveButtonEnabled(shouldBeEnabled = true): Promise<void> {
    if (shouldBeEnabled) {
      await expect(this.saveButton).toBeEnabled();
    } else {
      await expect(this.saveButton).toBeDisabled();
    }
  }

  async verifySkipGuestConversionCheckbox(shouldBeChecked: boolean): Promise<void> {
    await expect(this.skipGuestConversionCheckbox).toBeVisible();
    if (shouldBeChecked) {
      await expect(this.skipGuestConversionCheckbox).toBeChecked();
    } else {
      await expect(this.skipGuestConversionCheckbox).not.toBeChecked();
    }
  }

  async verifySkipWarningMessage(): Promise<void> {
    const skipWarningMessage = this.modal.getByText(
      /If skipped, the VMs' disk data will be duplicated byte-for-byte, allowing for faster conversions. However, there is a risk that the VMs might not function properly and it is not recommended./,
    );
    await expect(skipWarningMessage).toBeVisible();
  }

  async verifyUseCompatibilityModeCheckbox(
    shouldBeVisible: boolean,
    shouldBeChecked?: boolean,
  ): Promise<void> {
    if (shouldBeVisible) {
      await expect(this.useCompatibilityModeCheckbox).toBeVisible();
      if (shouldBeChecked !== undefined) {
        if (shouldBeChecked) {
          await expect(this.useCompatibilityModeCheckbox).toBeChecked();
        } else {
          await expect(this.useCompatibilityModeCheckbox).not.toBeChecked();
        }
      }
    } else {
      await expect(this.useCompatibilityModeCheckbox).not.toBeVisible();
    }
  }

  async waitForModalToClose(): Promise<void> {
    await expect(this.modal).not.toBeVisible();
  }

  async waitForModalToOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }
}
