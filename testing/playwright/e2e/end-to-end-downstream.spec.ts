import fs from 'fs';

import { test } from '@playwright/test';

import * as providers from '../../.providers.json';
import { CreatePlanWizardPage } from '../page-objects/CreatePlanWizard/CreatePlanWizardPage';
import { CreateProviderWizardPage } from '../page-objects/CreateProviderWizard/CreateProviderWizardPage';
import { LoginPage } from '../page-objects/LoginPage';
import { PlanDetailsPage } from '../page-objects/PlanDetailsPage';
import { PlansListPage } from '../page-objects/PlansListPage';
import { ProviderDetailsPage } from '../page-objects/ProviderDetailsPage';
import { ProvidersListPage } from '../page-objects/ProvidersListPage';

import { createPlanTestData, type ProviderData } from './shared/test-data';

const authFile = 'playwright/.auth/user.json';

test.beforeAll(async ({ browser }) => {
  const needsAuth = process.env.CLUSTER_USERNAME && process.env.CLUSTER_PASSWORD;

  if (!needsAuth) {
    return;
  }

  const page = await browser.newPage();
  const loginPage = new LoginPage(page);
  await loginPage.login(
    process.env.BASE_ADDRESS,
    process.env.CLUSTER_USERNAME,
    process.env.CLUSTER_PASSWORD,
  );
  await page.context().storageState({ path: authFile });
  await page.close();
});

test.describe.serial(
  'Plans - Downstream End-to-End Migration',
  {
    tag: '@downstream',
  },
  () => {
    test.beforeAll(() => {
      // Debug: Check for providers file and environment variables
      // eslint-disable-next-line no-console
      console.error('🔍 Debug: Checking downstream test environment setup...');
      // eslint-disable-next-line no-console
      console.error(`Current working directory: ${process.cwd()}`);

      // Check if providers file exists in current directory (should be /tmp/playwright-tests/testing)
      const providersPath = '.providers.json'; // File should be in current directory
      // eslint-disable-next-line no-console
      console.error(`Checking for providers file: ${providersPath}`);

      if (fs.existsSync(providersPath)) {
        // eslint-disable-next-line no-console
        console.error('✅ .providers.json exists in test directory');
        try {
          const providersContent = fs.readFileSync(providersPath, 'utf8');
          const providersData = JSON.parse(providersContent);

          // Create sanitized version without secrets
          const sanitized = JSON.parse(
            JSON.stringify(providersData, (key, value) => {
              if (key === 'password' || key === 'thumbprint' || key === 'cacert') {
                return '***REDACTED***';
              }
              return value as string;
            }),
          );

          // eslint-disable-next-line no-console
          console.error(
            '📄 Provider structure (without secrets):',
            JSON.stringify(sanitized, null, 2).length,
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Error reading .providers.json:', (error as Error).message);
        }
      } else {
        // eslint-disable-next-line no-console
        console.error('❌ .providers.json not found in test directory');
        // eslint-disable-next-line no-console
        console.error('Available files in test directory:');
        try {
          const files = fs.readdirSync('.');
          files.forEach((file) => {
            // eslint-disable-next-line no-console
            console.error(`  - ${file}`);
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Error listing files:', (error as Error).message);
        }
      }

      // Check environment variables (downstream specific)
      // eslint-disable-next-line no-console
      console.error('🔍 Environment variables for downstream tests:');
      // eslint-disable-next-line no-console
      console.error(`CLUSTER_USERNAME: ${process.env.CLUSTER_USERNAME ?? 'NOT_SET'}`);
      // eslint-disable-next-line no-console
      console.error(`CLUSTER_PASSWORD: ${process.env.CLUSTER_PASSWORD ? '***SET***' : 'NOT_SET'}`);
      // eslint-disable-next-line no-console
      console.error(`VSPHERE_USERNAME: ${process.env.VSPHERE_USERNAME ?? 'NOT_SET'}`);
      // eslint-disable-next-line no-console
      console.error(`VSPHERE_PASSWORD: ${process.env.VSPHERE_PASSWORD ? '***SET***' : 'NOT_SET'}`);
      // eslint-disable-next-line no-console
      console.error(`VSPHERE_URL: ${process.env.VSPHERE_URL ?? 'NOT_SET'}`);
      // eslint-disable-next-line no-console
      console.error(`BASE_ADDRESS: ${process.env.BASE_ADDRESS ?? 'NOT_SET'}`);

      // eslint-disable-next-line no-console
      console.error(`JENKINS: ${process.env.JENKINS ?? 'NOT_SET'}`);
      // eslint-disable-next-line no-console
      console.error(`CI: ${process.env.CI ?? 'NOT_SET'}`);

      // Downstream tests always run against real environment

      // eslint-disable-next-line no-console
      console.error('🌐 Downstream mode: Using real environment, no intercepts');
    });

    test.beforeEach(async ({ page: _page }) => {
      // The test storage state is created in the beforeAll hook.
    });

    let testProviderData: ProviderData = null;

    test('should create a new vsphere provider', async ({ page }) => {
      const providersPage = new ProvidersListPage(page);
      await providersPage.navigateFromMainMenu();
      const createWizard = new CreateProviderWizardPage(page);

      const vsphereProvider = providers['vsphere-8.0.1'];

      // if (!vsphereProvider.api_url || !vsphereProvider.username || !vsphereProvider.password || !vsphereProvider.vddk_init_image) {
      //   test.skip(true, 'Missing credentials variables for vSphere provider');
      // }

      testProviderData = {
        name: `test-vsphere-provider-${Date.now()}`,
        type: 'vsphere',
        hostname: vsphereProvider.api_url,
        username: vsphereProvider.username,
        password: vsphereProvider.password,
        vddkInitImage: vsphereProvider.vddk_init_image,
      };

      await providersPage.clickCreateProviderButton();
      await createWizard.waitForWizardLoad();
      await createWizard.fillAndSubmit(testProviderData);
      //await providersPage.waitForPageLoad();

      // Navigate to provider details and verify
      //await page.click(`text=${testProviderData.name}`);
      const providerDetailsPage = new ProviderDetailsPage(page);
      await providerDetailsPage.verifyBasicProviderDetailsPage({
        providerName: testProviderData.name,
      });
    });

    test(
      'should run plan creation wizard',
      {
        tag: [],
      },
      async ({ page }) => {
        //`real-test-plan-${Date.now()}`
        const planName = `real-test-plan-${Date.now()}`;
        const testPlanData = createPlanTestData({
          planName,
          planProject: 'openshift-mtv',
          sourceProvider: testProviderData.name,
          targetProvider: 'host',
          targetProject: 'default',
          networkMap: {
            name: `${planName}-network-map`,
            exists: false,
          },
          storageMap: {
            name: `${planName}-storage-map`,
            exists: false,
          },
        });
        const plansPage = new PlansListPage(page);
        await plansPage.navigateFromMainMenu();
        const createWizard = new CreatePlanWizardPage(page);
        const planDetailsPage = new PlanDetailsPage(page);

        // Navigate to the wizard
        await plansPage.clickCreatePlanButton();
        await createWizard.waitForWizardLoad();

        // Fill and submit the wizard
        await createWizard.fillAndSubmit(testPlanData);

        // Verify plan details page
        await planDetailsPage.waitForPageLoad();
        await planDetailsPage.verifyBasicPlanDetailsPage({
          planName: testPlanData.planName,
          planProject: testPlanData.planProject,
          sourceProvider: testPlanData.sourceProvider,
          targetProvider: testPlanData.targetProvider,
          targetProject: testPlanData.targetProject,
        });
      },
    );

    // test(
    //   'should validate external console connectivity',
    //   {
    //     tag: '@connectivity',
    //   },
    //   async ({ page }) => {
    //     const externalUrl = process.env.EXTERNAL_CONSOLE_URL ?? process.env.BASE_ADDRESS;

    //     if (!externalUrl || externalUrl === 'http://localhost:9000') {
    //       test.skip(true, 'External console URL not provided, skipping connectivity test');
    //     }

    //     // eslint-disable-next-line no-console
    //     console.error(`🔗 Testing connectivity to: ${externalUrl!}`);

    //     // Basic connectivity test - should be able to load the console
    //     const response = await page.goto(externalUrl!, {
    //       waitUntil: 'networkidle',
    //       timeout: 60000,
    //     });

    //     // eslint-disable-next-line no-console
    //     console.error(`📊 Response status: ${response?.status()}`);

    //     // Should get a valid response (not a complete failure)
    //     if (response && response.status() >= 400) {
    //       // eslint-disable-next-line no-console
    //       console.error(`⚠️  Got HTTP ${response.status()}, but continuing...`);
    //     }

    //     // eslint-disable-next-line no-console
    //     console.error('✅ Basic connectivity test completed');
    //   },
    // );
  },
);
