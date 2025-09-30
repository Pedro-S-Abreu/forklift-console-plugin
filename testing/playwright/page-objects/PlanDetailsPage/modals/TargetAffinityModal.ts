import { expect, type Locator, type Page } from '@playwright/test';

export class TargetAffinityModal {
  readonly addAffinityRuleButton: Locator;
  readonly addRuleDialog: Locator;
  readonly cancelButton: Locator;
  readonly modal: Locator;
  protected readonly page: Page;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = this.page.getByTestId('affinity-modal');
    this.saveButton = this.page.getByTestId('modal-confirm-button');
    this.cancelButton = this.page.getByTestId('modal-cancel-button');
    this.addAffinityRuleButton = this.page.getByTestId('add-affinity-rule-button');
    this.addRuleDialog = this.page.getByTestId('affinity-edit-modal');
  }

  async addExpression(): Promise<void> {
    // Click the add expression button in the add/edit rule dialog
    const addExpressionButton = this.addRuleDialog.getByTestId('add-affinity-expression-button');
    await addExpressionButton.click();
    // Wait for the expression fields to appear (use page-level since fields may be outside wrapper)
    await expect(this.page.getByPlaceholder('Enter key')).toBeVisible();
  }

  async addField(): Promise<void> {
    // Click the add field button in the add/edit rule dialog
    const addFieldButton = this.addRuleDialog.getByTestId('add-affinity-field-button');
    await addFieldButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForModalToClose();
  }

  async clickAddAffinityRule(): Promise<void> {
    await this.addAffinityRuleButton.click();
    // Wait for the add/edit rule dialog to appear
    await expect(this.addRuleDialog).toBeVisible();
  }

  async fillExpressionKey(key: string, index = 0): Promise<void> {
    // Fill the key field for an expression (use page-level since fields may be outside wrapper)
    const keyInput = this.page.getByPlaceholder('Enter key').nth(index);
    await keyInput.waitFor({ state: 'visible' });
    await keyInput.fill(key);
  }

  async fillExpressionValue(value: string, index = 0): Promise<void> {
    // Fill the value field for an expression (use page-level since fields may be outside wrapper)
    const valueInput = this.page.getByPlaceholder('Enter value').nth(index);
    await valueInput.waitFor({ state: 'visible' });
    await valueInput.fill(value);
    await valueInput.press('Enter');
  }

  async fillTopologyKey(topologyKey: string): Promise<void> {
    // Fill the topology key field (required for pod affinity/anti-affinity)
    const topologyKeyInput = this.addRuleDialog.getByTestId('affinity-topology-key-input');
    await topologyKeyInput.waitFor({ state: 'visible' });
    await topologyKeyInput.fill(topologyKey);
  }

  async fillWeight(weight: string): Promise<void> {
    // Fill the weight field (only visible for "Preferred during scheduling")
    const weightInput = this.addRuleDialog.getByTestId('affinity-weight-input');
    await weightInput.waitFor({ state: 'visible' });
    await weightInput.fill(weight);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.waitForModalToClose();
  }

  async saveAffinityRule(): Promise<void> {
    // Save button is in Modal footer (outside the affinity-edit-modal wrapper)
    // Use page-level locator since the test ID is globally unique
    const saveRuleButton = this.page.getByTestId('save-affinity-rule-button');
    await expect(saveRuleButton).toBeEnabled();
    await saveRuleButton.click();
    // Wait for the dialog to close
    await expect(this.addRuleDialog).not.toBeVisible();
  }

  async selectAffinityType(
    type: 'Node affinity' | 'Workload (pod) affinity' | 'Workload (pod) anti-affinity',
  ): Promise<void> {
    // Click the Type select dropdown
    const typeSelect = this.addRuleDialog.getByTestId('affinity-type-select');
    await typeSelect.click();
    // Select the option from the menu
    await this.page.getByRole('option', { name: type, exact: true }).click();
  }

  async selectExpressionOperator(
    operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist',
    index = 0,
  ): Promise<void> {
    // Select operator for an expression
    const operatorButton = this.addRuleDialog
      .locator('button[aria-label="Options menu"]')
      .nth(index);
    await operatorButton.click();
    await this.page.getByRole('option', { name: operator, exact: true }).click();
  }

  async selectRuleType(
    ruleType: 'Required during scheduling' | 'Preferred during scheduling',
  ): Promise<void> {
    // Click the Condition select dropdown
    const conditionSelect = this.addRuleDialog.getByTestId('affinity-condition-select');
    await conditionSelect.click();
    // Select the option from the menu
    await this.page.getByRole('option', { name: ruleType, exact: true }).click();
  }

  async verifyAffinityRuleExists(): Promise<void> {
    // Check if there's at least one affinity rule in the list
    const rulesList = this.modal.getByTestId('affinity-rules-list');
    await expect(rulesList).toBeVisible();

    // Also verify that "No affinity rules found" is not present
    await expect(this.modal.getByText('No affinity rules found')).not.toBeVisible();
  }

  async verifyAffinityTypeOptions(expectedOptions: string[]): Promise<void> {
    // Click the Type select dropdown to open it
    const typeSelect = this.addRuleDialog.getByTestId('affinity-type-select');
    await typeSelect.click();

    // Verify each expected option is present
    for (const option of expectedOptions) {
      await expect(this.page.getByRole('option', { name: option, exact: true })).toBeVisible();
    }

    // Close the dropdown by clicking the button again (toggle)
    await typeSelect.click();

    // Wait for menu to be hidden
    await expect(this.page.getByRole('option').first()).not.toBeVisible();
  }

  async verifyConditionOptions(expectedOptions: string[]): Promise<void> {
    // Click the Condition select dropdown to open it
    const conditionSelect = this.addRuleDialog.getByTestId('affinity-condition-select');
    await conditionSelect.click();

    // Verify each expected option is present
    for (const option of expectedOptions) {
      await expect(this.page.getByRole('option', { name: option, exact: true })).toBeVisible();
    }

    // Close the dropdown by clicking the button again (toggle)
    await conditionSelect.click();

    // Wait for menu to be hidden
    await expect(this.page.getByRole('option').first()).not.toBeVisible();
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
