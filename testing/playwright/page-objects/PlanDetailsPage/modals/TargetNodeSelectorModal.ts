import { expect, type Locator, type Page } from '@playwright/test';

export class TargetNodeSelectorModal {
  readonly addButton: Locator;
  readonly cancelButton: Locator;
  readonly modal: Locator;
  protected readonly page: Page;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = this.page.getByTestId('node-selector-modal');
    this.saveButton = this.page.getByTestId('modal-confirm-button');
    this.cancelButton = this.page.getByTestId('modal-cancel-button');
    this.addButton = this.modal.getByRole('button', { name: /add/i });
  }

  async addNodeSelector(key: string, value: string): Promise<void> {
    // Click the add button to add a new node selector row
    await this.addButton.click();

    // Wait for the new input fields to appear
    const keyInputs = this.modal.getByTestId('node-selector-key-input');
    const valueInputs = this.modal.getByTestId('node-selector-value-input');

    // Fill in the last (newly added) key and value inputs
    const keyInput = keyInputs.last();
    await keyInput.waitFor({ state: 'visible' });
    await keyInput.fill(key);

    const valueInput = valueInputs.last();
    await valueInput.waitFor({ state: 'visible' });
    await valueInput.fill(value);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForModalToClose();
  }

  async deleteNodeSelectorByKey(key: string): Promise<void> {
    // Find all key inputs and get the index of the one with the matching value
    const keyInputs = this.modal.getByTestId('node-selector-key-input');
    const count = await keyInputs.count();

    for (let i = 0; i < count; i += 1) {
      const inputValue = await keyInputs.nth(i).inputValue();
      if (inputValue === key) {
        // Find the delete button in the same row (using parent navigation)
        const deleteButton = this.modal
          .locator('button')
          .filter({ has: this.page.locator('svg') })
          .nth(i);
        await deleteButton.click();
        break;
      }
    }
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.waitForModalToClose();
  }

  async verifyNodeSelectorExists(key: string, value: string): Promise<void> {
    // Find all key inputs and verify the one with matching key has the correct value
    const keyInputs = this.modal.getByTestId('node-selector-key-input');
    const valueInputs = this.modal.getByTestId('node-selector-value-input');
    const count = await keyInputs.count();

    let found = false;
    for (let i = 0; i < count; i += 1) {
      const keyValue = await keyInputs.nth(i).inputValue();
      if (keyValue === key) {
        const valueValue = await valueInputs.nth(i).inputValue();
        expect(valueValue).toBe(value);
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
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
