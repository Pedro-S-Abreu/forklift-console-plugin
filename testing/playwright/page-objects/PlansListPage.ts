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
    return this.page.getByTestId('create-plan-button');
  }

  async loginProgrammatically() {
    const baseURL =
      process.env.BRIDGE_BASE_ADDRESS ?? process.env.BASE_ADDRESS ?? 'http://localhost:9000';
    const loginUrl = `${baseURL}/login`;
    const getResponse = await this.page.request.get(loginUrl);
    const body = await getResponse.text();
    const csrfToken = /name="csrf" value="(?<csrf_token>[^"]+)"/.exec(body)?.groups?.csrf_token;
    if (!csrfToken) {
      throw new Error('CSRF token not found');
    }

    const postData = {
      then: '/oauth/authorize?client_id=openshift-browser-client&redirect_uri=https%3A%2F%2Foauth-openshift.apps.qemtv-09.rhos-psi.cnv-qe.rhood.us%2Foauth%2Ftoken%2Fdisplay%26response_type%3Dcode',
      csrf: csrfToken,
      username: process.env.CLUSTER_USERNAME,
      password: process.env.CLUSTER_PASSWORD,
    };

    await this.page.request.post(loginUrl, {
      form: postData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      },
    });
  }

  async navigateFromMainMenu() {
    // eslint-disable-next-line no-console
    console.log(`Navigating to /`);
    try {
      const response = await this.page.goto('/');
      // eslint-disable-next-line no-console
      console.log(`Navigation to / completed.`);
      if (response) {
        // eslint-disable-next-line no-console
        console.log(`Response status: ${response.status()}`);
        // eslint-disable-next-line no-console
        console.log('Response headers:', JSON.stringify(await response.allHeaders(), null, 2));
        const isOk = response.ok();
        // eslint-disable-next-line no-console
        console.log(`Response ok: ${isOk}`);
        if (!isOk) {
          // eslint-disable-next-line no-console
          console.log(`Response text: ${await response.text()}`);
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('No response from page.goto("/")');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Error navigating to /: ${e.message}`);
      // eslint-disable-next-line no-console
      console.error(e.stack);
      throw e;
    }

    await disableGuidedTour(this.page);
    await waitForLoader(this.page);
    await this.page.getByTestId('migration-nav-item').click();
    await this.page.getByTestId('plans-nav-item').click();

    expect(this.page.url()).toContain('forklift.konveyor.io~v1beta1~Plan');
  }

  async waitForPageLoad() {
    await expect(this.page.getByRole('grid', { name: 'Migration plans' })).toBeVisible();
  }
}
