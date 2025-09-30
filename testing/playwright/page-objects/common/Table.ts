import { expect, type Locator, type Page } from '@playwright/test';

export class Table {
  private readonly page: Page;
  private readonly rootLocator: Locator;

  constructor(page: Page, rootLocator: Locator) {
    this.page = page;
    this.rootLocator = rootLocator;
  }

  async changeFilter(filterName: string): Promise<void> {
    const filterSelect = this.rootLocator
      .getByTestId('table-filter-select')
      .or(this.rootLocator.getByRole('button').filter({ hasText: /^(?:Name|Concerns|Host)$/ }));

    await filterSelect.click();
    await this.page.getByRole('menuitem', { name: filterName, exact: true }).click();
  }

  async clearAllFilters(): Promise<void> {
    const clearButton = this.rootLocator
      .getByTestId('clear-all-filters')
      .or(this.page.getByRole('button', { name: 'Clear all filters' }));

    await clearButton.click();
  }

  async clickRow(options: Record<string, string>): Promise<void> {
    const row = this.getRow(options);
    await row.click();
  }

  async clickRowByTestId(testId: string): Promise<void> {
    const row = this.getRowByTestId(testId);
    await row.click();
  }

  async enableColumn(columnName: string): Promise<void> {
    // First check if the column is already visible
    const currentColumns = await this.getColumns();
    if (currentColumns.some((col) => col === columnName)) {
      // Column is already visible, no need to enable it
      return;
    }

    // Click Manage columns to open the modal
    const manageColumnsButton = this.rootLocator.getByRole('button', { name: 'Manage columns' });
    await manageColumnsButton.click();

    // Wait for the modal to be visible
    const modal = this.page.getByRole('dialog', { name: 'Manage columns' });
    await expect(modal).toBeVisible();

    // Find the list item that exactly matches the column name
    const columnList = modal.getByRole('list', { name: 'Manage columns' });
    const targetListItem = columnList
      .getByRole('listitem')
      .filter({ hasText: new RegExp(`^${columnName}$`) });

    if ((await targetListItem.count()) === 0) {
      // Close the modal and throw an error
      const cancelButton = modal.getByRole('button', { name: 'Cancel' });
      await cancelButton.click();
      await expect(modal).not.toBeVisible();
      throw new Error(`Column "${columnName}" not found in available columns`);
    }

    // Check if the column has a checkbox and enable it if not already checked
    const checkbox = targetListItem.getByRole('checkbox');
    if ((await checkbox.count()) > 0) {
      const isChecked = await checkbox.isChecked();
      const isDisabled = await checkbox.isDisabled();

      if (!isDisabled && !isChecked) {
        await checkbox.check();
      }
    }

    // Save the changes
    const saveButton = modal.getByRole('button', { name: 'Save' });
    await saveButton.click();

    // Wait for modal to close
    await expect(modal).not.toBeVisible();
  }

  async getColumns(): Promise<string[]> {
    // Get all visible column headers from the table
    const tableContainer = this.rootLocator
      .getByTestId('table-grid')
      .or(this.rootLocator.getByRole('table'))
      .or(this.rootLocator.getByRole('grid'));

    const headers = tableContainer.locator('thead th, thead columnheader');
    const count = await headers.count();

    const headerTexts = await Promise.all(
      Array.from({ length: count }, async (_, i) => headers.nth(i).textContent()),
    );

    return headerTexts
      .filter((text) => text?.trim() && !text.includes('Row select') && !text.includes('Details'))
      .map((text) => text!.replace(/\s+/g, ' ').trim())
      .filter((cleanText) => cleanText && cleanText !== 'More information on concerns');
  }

  getRow(options: Record<string, string>): Locator {
    // Try both table and grid roles to support different table implementations
    const tableContainer = this.rootLocator
      .getByTestId('table-grid')
      .or(this.rootLocator.getByRole('table'))
      .or(this.rootLocator.getByRole('grid'));

    let rows = tableContainer.locator('tbody tr');

    for (const [_columnName, expectedValue] of Object.entries(options)) {
      rows = rows.filter({ hasText: expectedValue });
    }

    return rows.first();
  }

  getRowByTestId(testId: string): Locator {
    return this.rootLocator.getByTestId(testId);
  }

  async isColumnVisible(columnName: string): Promise<boolean> {
    const currentColumns = await this.getColumns();
    return currentColumns.some((col) => col === columnName);
  }

  async search(value: string): Promise<void> {
    const searchInput = this.rootLocator.getByRole('textbox', { name: 'Search input' });

    await searchInput.fill(value);
    await searchInput.press('Enter');
  }

  async selectRow(options: Record<string, string>): Promise<void> {
    const row = this.getRow(options);
    const checkbox = row.getByTestId('row-select-checkbox').or(row.getByRole('checkbox'));
    await checkbox.check();
  }

  async selectRowByTestId(testId: string): Promise<void> {
    const row = this.getRowByTestId(testId);
    const checkbox = row.getByTestId('row-select-checkbox').or(row.getByRole('checkbox'));
    await checkbox.check();
  }

  async verifyRowIsVisible(options: Record<string, string>): Promise<void> {
    const row = this.getRow(options);
    await expect(row).toBeVisible();
  }

  async waitForTableLoad(): Promise<void> {
    // Wait for table to be visible and not show loading state - support both table and grid
    const tableContainer = this.rootLocator
      .getByTestId('table-grid')
      .or(this.rootLocator.getByRole('table'))
      .or(this.rootLocator.getByRole('grid'));
    await expect(tableContainer).toBeVisible();

    // Wait for at least one row or empty state - support tbody tr structure
    await expect(
      tableContainer
        .locator('tbody tr')
        .first()
        .or(this.rootLocator.getByText('No results found'))
        .or(this.rootLocator.getByText(/No .* found/)),
    ).toBeVisible();
  }
}
