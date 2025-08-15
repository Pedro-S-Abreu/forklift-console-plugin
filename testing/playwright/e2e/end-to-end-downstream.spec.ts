import { test } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

// Check if .providers.json file exists
const providersPath = join(__dirname, '../../.providers.json');
if (!existsSync(providersPath)) {
  throw new Error(`.providers.json file not found at: ${providersPath}`);
}

import * as providers from '../../.providers.json';
import { CreatePlanWizardPage } from '../page-objects/CreatePlanWizard/CreatePlanWizardPage';
import { CreateProviderWizardPage } from '../page-objects/CreateProviderWizard/CreateProviderWizardPage';
import { LoginPage } from '../page-objects/LoginPage';
import { PlanDetailsPage } from '../page-objects/PlanDetailsPage';
import { PlansListPage } from '../page-objects/PlansListPage';
import { ProviderDetailsPage } from '../page-objects/ProviderDetailsPage';
import { ProvidersListPage } from '../page-objects/ProvidersListPage';
import { ResourceManager } from '../utils/ResourceManager';
import { disableGuidedTour } from '../utils/utils';

import { createPlanTestData, type ProviderData } from './shared/test-data';

test.describe.serial(
  'Plans - Downstream End-to-End Migration',
  {
    tag: '@downstream',
  },
  () => {
    const resourceManager = new ResourceManager();

    test.beforeEach(async ({ page }) => {
      // Disable guided tour BEFORE navigation to ensure the script is injected
      await disableGuidedTour(page);
      
      // Navigate to console
      const consoleUrl = process.env.CONSOLE_URL ?? 'http://localhost:9000';
      await page.goto(consoleUrl);
      await page.waitForLoadState('domcontentloaded');

      // Login if credentials are provided
      if (process.env.CLUSTER_USERNAME && process.env.CLUSTER_PASSWORD) {
        try {
          const loginPage = new LoginPage(page);
          await loginPage.login(
            consoleUrl,
            process.env.CLUSTER_USERNAME,
            process.env.CLUSTER_PASSWORD,
          );
        } catch (error) {
          // If login fails, assume already logged in
          console.log('Login failed, assuming already authenticated');
        }
      }
    });

    let testProviderData: ProviderData = {
      name: '',
      type: 'vsphere',
      endpointType: 'vcenter',
      hostname: '',
      username: '',
      password: '',
      vddkInitImage: '',
    };

    test('should create a new vsphere provider', async ({ page }) => {
      const providersPage = new ProvidersListPage(page);
      await providersPage.navigateFromMainMenu();
      const createWizard = new CreateProviderWizardPage(page);

      const providerKey = process.env.VSPHERE_PROVIDER ?? 'vsphere-8.0.1';
      const vsphereProvider = (providers as Record<string, any>)[providerKey] as {
        api_url: string;
        username: string;
        password: string;
        vddk_init_image: string;
      };

      const providerName = `test-vsphere-provider-${Date.now()}`;
      
      // Track the provider for cleanup
      resourceManager.addResource({
        namespace: 'openshift-mtv',
        resourceType: 'providers',
        resourceName: providerName
      });

      testProviderData = {
        name: providerName,
        type: 'vsphere',
        endpointType: 'esxi',
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
      await providerDetailsPage.verifyProviderDetails({
        providerName: testProviderData.name,
      });
    });

    test(
      'should run plan creation wizard',
      {
        tag: [],
      },
      async ({ page }) => {
        const planName = `real-test-plan-${Date.now()}`;
        
        // Track the plan for cleanup
        resourceManager.addResource({
          namespace: 'openshift-mtv',
          resourceType: 'plans',
          resourceName: planName
        });

        // Track network and storage maps
        resourceManager.addResource({
          namespace: 'openshift-mtv',
          resourceType: 'networkmaps',
          resourceName: `${planName}-network-map`
        });

        resourceManager.addResource({
          namespace: 'openshift-mtv',
          resourceType: 'storagemaps',
          resourceName: `${planName}-storage-map`
        });

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

    // Final cleanup test - runs last and cleans up all resources
    test('cleanup all test resources', async ({ page }) => {
      if (resourceManager.getResourceCount() > 0) {
        // eslint-disable-next-line no-console
        console.log(`🧹 Cleaning up ${resourceManager.getResourceCount()} resources...`);
        await resourceManager.cleanupAll(page);
      } else {
        // eslint-disable-next-line no-console
        console.log('No resources to cleanup.');
      }
    });
  },
);
