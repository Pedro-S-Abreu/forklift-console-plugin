import { expect, type Page } from '@playwright/test';

import { disableGuidedTour, waitForLoader } from '../utils/utils';

export class PlansListPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async assertCreatePlanButtonEnabled() {
    await expect(this.createPlanButton).toBeVisible();
    await expect(this.createPlanButton).toBeEnabled();
    await expect(this.createPlanButton).not.toHaveAttribute('aria-disabled', 'true');
  }

  async clickCreatePlanButton() {
    await this.assertCreatePlanButtonEnabled();
    await this.createPlanButton.click();
  }

  get createPlanButton() {
    // TODO: TEMPORARY FIX - The cluster version has wrong testId due to bug in git history
    // There are 2 buttons with text "Create Plan" - we want the first (enabled) one
    // This was fixed in commit ae2930a6 [MTV-2962] but cluster is running older version
    // REMOVE THIS FALLBACK when cluster is updated to include commit ae2930a6 or later

    // Select first "Create Plan" button (the enabled one)
    return this.page.getByRole('button', { name: 'Create Plan' }).first();

    // FUTURE: When cluster is updated to commit ae2930a6 or later, use this:
    // return this.page.getByTestId('create-plan-button');

    // REFERENCE: The wrong testId currently on cluster:
    // return this.page.getByTestId('add-network-map-button');
  }

  async navigateFromMainMenu() {
    await disableGuidedTour(this.page);
    await this.page.goto('/');

    // Ensure viewport is set correctly
    await this.page.setViewportSize({ width: 1280, height: 720 });

    await waitForLoader(this.page);

    // Wait for navigation elements to be visible before clicking
    await this.page.getByTestId('migration-nav-item').waitFor({ state: 'visible', timeout: 10000 });
    await this.page.getByTestId('migration-nav-item').click();

    await this.page.getByTestId('plans-nav-item').waitFor({ state: 'visible', timeout: 10000 });
    await this.page.getByTestId('plans-nav-item').click();

    expect(this.page.url()).toContain('forklift.konveyor.io~v1beta1~Plan');
  }

  async waitForPageLoad() {
    await expect(this.page.getByRole('grid', { name: 'Migration plans' })).toBeVisible();
  }
}
