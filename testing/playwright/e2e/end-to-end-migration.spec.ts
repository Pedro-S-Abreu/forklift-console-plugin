import fs from 'fs';

import { test } from '@playwright/test';

import { TEST_DATA } from '../fixtures/test-data';
import { setupCreatePlanIntercepts } from '../intercepts';
import { CreatePlanWizardPage } from '../page-objects/CreatePlanWizard/CreatePlanWizardPage';
import { PlanDetailsPage } from '../page-objects/PlanDetailsPage';
import { PlansListPage } from '../page-objects/PlansListPage';
import { setupAuthentication } from '../utils/auth';

test.describe('Plans - Critical End-to-End Migration', () => {
  test.beforeEach(async ({ page }) => {
    // Debug: Check for providers file and environment variables
    // eslint-disable-next-line no-console
    console.error('🔍 Debug: Checking test environment setup...');
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
        const providers = JSON.parse(providersContent);

        // Create sanitized version without secrets
        const sanitized = JSON.parse(
          JSON.stringify(providers, (key, value) => {
            if (key === 'password' || key === 'thumbprint' || key === 'cacert') {
              return '***REDACTED***';
            }
            return value as string;
          }),
        );

        // eslint-disable-next-line no-console
        console.error(
          '📄 Provider structure (without secrets):',
          JSON.stringify(sanitized, null, 2),
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

    // Check environment variables
    // eslint-disable-next-line no-console
    console.error('🔍 Environment variables for tests:');
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
    // Authenticate if in Jenkins (real environment)
    if (process.env.JENKINS === 'true') {
      await setupAuthentication(page, {
        baseUrl: process.env.BASE_ADDRESS ?? 'http://localhost:9000',
        username: process.env.CLUSTER_USERNAME,
        password: process.env.CLUSTER_PASSWORD,
      });
    } else {
      await setupCreatePlanIntercepts(page);
    }

    const plansPage = new PlansListPage(page);
    await plansPage.navigateFromMainMenu();
  });

  test('should run plan creation wizard', async ({ page }) => {
    const plansPage = new PlansListPage(page);
    const createWizard = new CreatePlanWizardPage(page);
    const planDetailsPage = new PlanDetailsPage(page);

    // Navigate to wizard
    await plansPage.waitForPageLoad();
    await plansPage.clickCreatePlanButton();
    await createWizard.waitForWizardLoad();

    // STEP 1: General Information
    await createWizard.generalInformation.fillPlanName(TEST_DATA.planName);
    await createWizard.generalInformation.selectPlanProject(TEST_DATA.planProject);
    await createWizard.generalInformation.selectSourceProvider(TEST_DATA.sourceProvider);
    await createWizard.generalInformation.selectTargetProvider(TEST_DATA.targetProvider);
    await createWizard.generalInformation.waitForTargetProviderNamespaces();
    await createWizard.generalInformation.selectTargetProject(TEST_DATA.targetProject);
    await createWizard.clickNext();

    // STEP 2: Virtual Machines
    await createWizard.virtualMachines.verifyStepVisible();
    await createWizard.virtualMachines.verifyTableLoaded();
    await createWizard.virtualMachines.selectFirstVirtualMachine();
    await createWizard.clickNext();

    // STEP 3: Network Map
    await createWizard.networkMap.verifyStepVisible();
    await createWizard.networkMap.waitForData();
    await createWizard.networkMap.selectNetworkMap(TEST_DATA.networkMap);
    await createWizard.clickNext();

    // STEP 4: Storage Map
    await createWizard.storageMap.verifyStepVisible();
    await createWizard.storageMap.waitForData();
    await createWizard.storageMap.selectStorageMap(TEST_DATA.storageMap);
    await createWizard.clickNext();
    await createWizard.clickSkipToReview();

    // STEP 5: Review
    await createWizard.review.verifyStepVisible();
    await createWizard.review.verifyAllSections(
      {
        planName: TEST_DATA.planName,
        planProject: TEST_DATA.planProject,
        sourceProvider: TEST_DATA.sourceProvider,
        targetProvider: TEST_DATA.targetProvider,
        targetProject: TEST_DATA.targetProject,
      },
      TEST_DATA.networkMap,
      TEST_DATA.storageMap,
    );

    // STEP 6: Create the plan and verify basic plan details
    await createWizard.clickNext();
    await createWizard.waitForPlanCreation();
    await planDetailsPage.waitForPageLoad();
    await planDetailsPage.verifyBasicPlanDetailsPage({
      planName: TEST_DATA.planName,
      sourceProvider: TEST_DATA.sourceProvider,
      targetProvider: TEST_DATA.targetProvider,
      targetProject: TEST_DATA.targetProject,
    });
  });
});
