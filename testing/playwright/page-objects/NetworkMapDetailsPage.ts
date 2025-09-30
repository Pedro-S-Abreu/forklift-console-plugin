import { expect, type Page } from '@playwright/test';

import { isEmpty } from '../utils/utils';

import { YamlEditorPage } from './YamlEditorPage';

export class NetworkMapDetailsPage {
  private readonly yamlEditor: YamlEditorPage;
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.yamlEditor = new YamlEditorPage(page);
  }

  async navigateToYamlTab(): Promise<void> {
    await this.page.getByRole('tab', { name: 'YAML' }).click();
    // Wait for YAML editor to load
    await expect(this.page.locator('.monaco-editor')).toBeVisible();
  }

  async verifyNetworkMapDetailsPage(expectedData: {
    networkMapName: string;
    sourceProvider: string;
    targetProvider: string;
    mappings?: {
      sourceNetwork: string;
      targetNetwork: string;
    }[];
    status?: 'Ready' | 'NotReady';
  }) {
    // Verify URL
    await expect(this.page).toHaveURL(
      new RegExp(
        `/k8s/ns/[^/]+/forklift\\.konveyor\\.io~v1beta1~NetworkMap/${expectedData.networkMapName}$`,
      ),
    );

    // Verify page title and heading
    await expect(this.page).toHaveTitle(
      new RegExp(`${expectedData.networkMapName}.*Network Map.*Details`),
    );
    await expect(
      this.page.getByRole('heading', {
        name: new RegExp(`NetworkMap.*${expectedData.networkMapName}`),
      }),
    ).toBeVisible();

    // Verify network map details section
    await expect(this.page.getByRole('heading', { name: 'Network map details' })).toBeVisible();

    // Verify name in the details section (more specific selector)
    await expect(
      this.page.getByTestId('name-detail-item').getByText(expectedData.networkMapName),
    ).toBeVisible();

    // Verify project (should be openshift-mtv) - use the link in the details section
    await expect(this.page.locator('[data-test-id="openshift-mtv"]')).toBeVisible();

    // Verify created at timestamp is present
    await expect(this.page.locator('time').first()).toBeVisible();

    // Verify providers section
    await expect(this.page.getByRole('heading', { name: 'Providers' })).toBeVisible();

    // Verify source provider
    await expect(this.page.getByText('Source provider')).toBeVisible();
    await expect(this.page.getByRole('link', { name: expectedData.sourceProvider })).toBeVisible();

    // Verify target provider
    await expect(this.page.getByText('Target provider')).toBeVisible();
    await expect(this.page.getByRole('link', { name: expectedData.targetProvider })).toBeVisible();

    // Verify map section - use exact match to avoid conflicts
    await expect(this.page.getByRole('heading', { name: 'Map', exact: true })).toBeVisible();

    // Verify mappings if provided
    if (expectedData.mappings && !isEmpty(expectedData.mappings)) {
      // Get all mapping rows and verify each one
      const mappingList = this.page
        .locator('ul')
        .filter({ hasText: expectedData.mappings[0].sourceNetwork });

      for (let i = 0; i < expectedData.mappings.length; i += 1) {
        const mapping = expectedData.mappings[i];
        const mappingRow = mappingList.locator('li').nth(i);

        // Check that both source and target networks are visible in this specific mapping row
        await expect(mappingRow.getByRole('button', { name: mapping.sourceNetwork })).toBeVisible();
        await expect(mappingRow.getByRole('button', { name: mapping.targetNetwork })).toBeVisible();
      }
    }

    // Verify conditions section
    await expect(this.page.getByRole('heading', { name: 'Conditions' })).toBeVisible();

    // Verify status if provided
    if (expectedData.status) {
      const statusText = expectedData.status === 'Ready' ? 'True' : 'False';
      await expect(this.page.getByRole('gridcell', { name: 'Ready' })).toBeVisible();
      await expect(this.page.getByRole('gridcell', { name: statusText })).toBeVisible();

      if (expectedData.status === 'Ready') {
        await expect(
          this.page.getByRole('gridcell', { name: 'The network map is ready.' }),
        ).toBeVisible();
      }
    }

    // Verify that the Details tab is selected
    await expect(this.page.getByRole('tab', { name: 'Details', selected: true })).toBeVisible();

    // Verify YAML tab is available
    await expect(this.page.getByRole('tab', { name: 'YAML' })).toBeVisible();
  }

  get yaml(): YamlEditorPage {
    return this.yamlEditor;
  }
}
