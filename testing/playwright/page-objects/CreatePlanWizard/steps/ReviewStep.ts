import { expect, type Page } from '@playwright/test';

export class ReviewStep {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async clickEditStepInSection(
    sectionName:
      | 'General'
      | 'Virtual machines'
      | 'Network map'
      | 'Storage map'
      | 'Migration type'
      | 'Other settings'
      | 'Hooks',
  ): Promise<void> {
    const sectionMap = {
      General: 'review-general-section',
      'Virtual machines': 'review-virtual-machines-section',
      'Network map': 'review-network-map-section',
      'Storage map': 'review-storage-map-section',
      'Migration type': 'review-migration-type-section',
      'Other settings': 'review-other-settings-section',
      Hooks: 'review-hooks-section',
    };

    const section = this.page.getByTestId(sectionMap[sectionName]);
    await section.getByRole('button', { name: 'Edit step' }).click();
  }

  async verifyAllSections(
    generalData: {
      planName: string;
      planProject: string;
      sourceProvider: string;
      targetProvider: string;
      targetProject: string;
    },
    expectedNetworkMap?: {
      name: string;
      isPreExisting: boolean;
    },
    expectedStorageMap?: {
      name: string;
      isPreExisting: boolean;
    },
  ): Promise<void> {
    await this.verifyGeneralSection(generalData);
    await this.verifyVirtualMachinesSection();
    await this.verifyNetworkMapSection(expectedNetworkMap);
    await this.verifyStorageMapSection(expectedStorageMap);
    await this.verifyMigrationTypeSection();
    await this.verifyOtherSettingsSection();
    await this.verifyHooksSection();
  }

  async verifyGeneralSection(expectedData: {
    planName: string;
    planProject: string;
    sourceProvider: string;
    targetProvider: string;
    targetProject: string;
  }): Promise<void> {
    await expect(this.page.getByTestId('review-general-section')).toBeVisible();
    await expect(this.page.getByTestId('review-plan-name')).toContainText(expectedData.planName);
    await expect(this.page.getByTestId('review-plan-project')).toContainText(
      expectedData.planProject,
    );
    await expect(this.page.getByTestId('review-source-provider')).toContainText(
      expectedData.sourceProvider,
    );
    await expect(this.page.getByTestId('review-target-provider')).toContainText(
      expectedData.targetProvider,
    );
    await expect(this.page.getByTestId('review-target-project')).toContainText(
      expectedData.targetProject,
    );
  }

  async verifyHooksSection(): Promise<void> {
    await expect(this.page.getByTestId('review-hooks-section')).toBeVisible();
    await expect(this.page.getByTestId('review-pre-migration-hook-enabled')).toBeVisible();
    await expect(this.page.getByTestId('review-post-migration-hook-enabled')).toBeVisible();
  }

  async verifyMigrationTypeSection(): Promise<void> {
    await expect(this.page.getByTestId('review-migration-type-section')).toBeVisible();
    // Migration type field exists but may be empty
    await expect(this.page.getByTestId('review-migration-type')).toBeVisible();
  }

  async verifyNetworkMapSection(expectedNetworkMap?: {
    name: string;
    isPreExisting: boolean;
  }): Promise<void> {
    const section = this.page.getByTestId('review-network-map-section');
    await expect(section).toBeVisible();

    if (expectedNetworkMap) {
      if (expectedNetworkMap.isPreExisting) {
        await expect(section.getByTestId('review-network-map')).toContainText(
          expectedNetworkMap.name,
        );
      } else {
        await expect(
          section.locator('.pf-v5-c-description-list__group', { hasText: 'Network map name' }),
        ).toContainText(expectedNetworkMap.name);
      }
    }
  }

  async verifyOtherSettingsSection(): Promise<void> {
    await expect(this.page.getByTestId('review-other-settings-section')).toBeVisible();
    await expect(this.page.getByTestId('review-transfer-network')).toBeVisible();
  }

  async verifyStepVisible(): Promise<void> {
    await expect(this.page.getByTestId('create-plan-review-step')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Review and create' })).toBeVisible();
  }

  async verifyStorageMapSection(expectedStorageMap?: {
    name: string;
    isPreExisting: boolean;
  }): Promise<void> {
    const section = this.page.getByTestId('review-storage-map-section');
    await expect(section).toBeVisible();
    if (expectedStorageMap) {
      if (expectedStorageMap.isPreExisting) {
        await expect(section.getByTestId('review-storage-map')).toContainText(
          expectedStorageMap.name,
        );
      } else {
        await expect(
          section.locator('.pf-v5-c-description-list__group', { hasText: 'Storage map name' }),
        ).toContainText(expectedStorageMap.name);
      }
    }
  }

  async verifyVirtualMachinesSection(): Promise<void> {
    await expect(this.page.getByTestId('review-virtual-machines-section')).toBeVisible();
    await expect(this.page.getByTestId('review-vm-count')).toContainText(
      'virtual machine selected',
    );
  }
}
