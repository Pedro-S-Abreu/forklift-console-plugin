import { expect, type Page } from '@playwright/test';

import { isEmpty } from '../utils/utils';

export class YamlEditorPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async copyYamlToClipboard(): Promise<string> {
    const yamlContent = await this.getYamlContent();
    await this.page.getByRole('button', { name: 'Copy code to clipboard' }).click();
    // Verify copy action was successful (tooltip appears)
    await expect(this.page.getByText('Content copied to clipboard')).toBeVisible();
    return yamlContent;
  }

  async fillYamlContent(yamlContent: string): Promise<void> {
    // Use Monaco editor API directly to set the content
    await this.page.evaluate((content) => {
      const monacoInstance = (window as any).monaco?.editor?.getModels?.()?.[0];
      if (monacoInstance) {
        monacoInstance.setValue(content);
      } else {
        // Fallback: try to find the editor instance
        const editors = (window as any).monaco?.editor?.getEditors?.();
        if (editors && Array.isArray(editors) && !isEmpty(editors)) {
          editors[0].setValue(content);
        }
      }
    }, yamlContent);
  }

  async getYamlContent(): Promise<string> {
    const yamlContent = await this.page.evaluate(() => {
      // Try to get the YAML content from the Monaco editor
      const monacoInstance = (window as any).monaco?.editor?.getModels?.()?.[0];
      if (monacoInstance) {
        return monacoInstance.getValue() as string;
      }
      return '';
    });
    return yamlContent;
  }

  async submitYamlForm(expectedName: string, resourceType: string): Promise<void> {
    await this.page.locator('[data-test="save-changes"]').click();
    // Wait for navigation to the new resource details page
    await expect(this.page).toHaveURL(
      new RegExp(
        `/k8s/ns/openshift-mtv/forklift\\.konveyor\\.io~v1beta1~${resourceType}/${expectedName}`,
      ),
    );
  }

  async waitForYamlEditorLoad(): Promise<void> {
    // Wait for YAML editor to load
    await expect(this.page.locator('.monaco-editor')).toBeVisible();
  }
}
