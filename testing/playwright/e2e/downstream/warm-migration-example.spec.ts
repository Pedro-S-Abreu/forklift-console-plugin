/**
 * Warm Migration Test Example
 * 
 * This test demonstrates how to properly handle warm migration tests
 * with automatic snapshot detection and cleanup warnings.
 * 
 * Key features:
 * - Pre-test snapshot detection
 * - Post-test snapshot warnings
 * - Manual cleanup instructions
 * - Fail-fast on snapshot detection (optional)
 */

import { existsSync } from 'fs';
import { join } from 'path';

import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures/warm-migration-fixtures';

const providersPath = join(__dirname, '../../../.providers.json');
if (!existsSync(providersPath)) {
  throw new Error(`.providers.json file not found at: ${providersPath}`);
}

import * as providers from '../../../.providers.json';
import { CreatePlanWizardPage } from '../../page-objects/CreatePlanWizard/CreatePlanWizardPage';
import { CreateProviderPage } from '../../page-objects/CreateProviderPage';
import { PlanDetailsPage } from '../../page-objects/PlanDetailsPage/PlanDetailsPage';
import { PlansListPage } from '../../page-objects/PlansListPage';
import { ProviderDetailsPage } from '../../page-objects/ProviderDetailsPage/ProviderDetailsPage';
import { ProvidersListPage } from '../../page-objects/ProvidersListPage';
import { createPlanTestData, type ProviderConfig, type ProviderData } from '../../types/test-data';
import { MTV_NAMESPACE } from '../../utils/resource-manager/constants';
import { ResourceManager } from '../../utils/resource-manager/ResourceManager';

const targetProjectName = `test-warm-migration-${Date.now()}`;

test.describe.serial('Plans - Warm Migration with Snapshot Detection', () => {
  const resourceManager = new ResourceManager();

  let testProviderData: ProviderData = {
    name: '',
    projectName: MTV_NAMESPACE,
    type: 'vsphere',
    endpointType: 'vcenter',
    hostname: '',
    username: '',
    password: '',
    vddkInitImage: '',
    useVddkAioOptimization: false,
  };

  const providerName = `test-vsphere-warm-${Date.now()}`;
  const planName = `${providerName}-warm-plan`;
  const warmTestVM = 'mtv-rhel8-warm-2disks2nics'; // Update with your test VM

  const testPlanData = createPlanTestData({
    planName,
    sourceProvider: providerName,
    virtualMachines: [
      {
        sourceName: warmTestVM,
        targetName: `${warmTestVM}-migrated-${Date.now()}`,
        folder: 'vm',
      },
    ],
    targetProject: {
      name: targetProjectName,
      isPreexisting: false,
    },
    migrationSettings: {
      // Enable warm migration
      warm: true,
    },
  });

  test.beforeAll(async ({ vsphereCleanup }) => {
    // Option 1: Just warn about snapshots
    const vmInfo = await vsphereCleanup.checkSnapshots(warmTestVM);
    if (vmInfo.hasSnapshots) {
      console.warn(
        `⚠️  WARNING: VM has ${vmInfo.snapshotCount} snapshot(s). Test may fail!`,
      );
    }

    // Option 2: Fail immediately if snapshots exist (strict mode)
    // Uncomment the line below to enable strict snapshot checking
    // await vsphereCleanup.failIfSnapshots(warmTestVM);
  });

  test(
    'should create a new vsphere provider',
    {
      tag: ['@downstream', '@warm-migration'],
    },
    async ({ page }) => {
      const providersPage = new ProvidersListPage(page);
      const createProvider = new CreateProviderPage(page, resourceManager);
      const providerDetailsPage = new ProviderDetailsPage(page);

      const providerKey = process.env.VSPHERE_PROVIDER ?? 'vsphere-8.0.1';
      const providerConfig = (providers as Record<string, ProviderConfig>)[providerKey];

      testProviderData = {
        name: providerName,
        projectName: MTV_NAMESPACE,
        type: providerConfig.type,
        endpointType: providerConfig.endpoint_type ?? 'vcenter',
        hostname: providerConfig.api_url,
        username: providerConfig.username,
        password: providerConfig.password,
        vddkInitImage: providerConfig.vddk_init_image,
        useVddkAioOptimization: false,
      };

      await providersPage.navigateFromMainMenu();
      await providersPage.clickCreateProviderButton();
      await createProvider.waitForWizardLoad();
      await createProvider.fillAndSubmit(testProviderData);
      await providerDetailsPage.waitForPageLoad();
      await providerDetailsPage.waitForReadyStatus();
      await providerDetailsPage.verifyProviderDetails(testProviderData);
    },
  );

  test(
    'should create a new warm migration plan',
    {
      tag: ['@downstream', '@warm-migration'],
    },
    async ({ page, vsphereCleanup }) => {
      test.setTimeout(60000);

      // Verify no snapshots before creating plan
      await vsphereCleanup.failIfSnapshots(warmTestVM);

      const plansPage = new PlansListPage(page);
      const createWizard = new CreatePlanWizardPage(page, resourceManager);
      const planDetailsPage = new PlanDetailsPage(page);

      await plansPage.navigateFromMainMenu();
      await plansPage.clickCreatePlanButton();
      await createWizard.waitForWizardLoad();
      await createWizard.fillAndSubmit(testPlanData);

      await planDetailsPage.verifyBasicPlanDetailsPage(testPlanData);
      
      // Verify plan shows "Ready for migration" and not snapshot errors
      await planDetailsPage.verifyPlanStatus('Ready for migration');
    },
  );

  test(
    'should run warm migration',
    {
      tag: ['@downstream', '@warm-migration', '@slow'],
    },
    async ({ page }) => {
      const timeout = 20 * 60000; // 20 minutes for warm migration
      test.setTimeout(timeout);
      
      const plansPage = new PlansListPage(page);
      const planDetailsPage = new PlanDetailsPage(page);

      await plansPage.navigateFromMainMenu();
      await plansPage.waitForPageLoad();
      await plansPage.navigateToPlan(planName);
      await planDetailsPage.verifyPlanTitle(planName);

      await planDetailsPage.verifyPlanStatus('Ready for migration');
      await planDetailsPage.clickActionsMenuAndStart();
      await planDetailsPage.verifyMigrationInProgress();

      console.log('⏳ Waiting for warm migration to complete...');
      await planDetailsPage.waitForMigrationCompletion(timeout, true);

      // Verify migrated VMs
      for (const vm of testPlanData.virtualMachines ?? []) {
        const migratedVMName = vm.targetName ?? vm.sourceName;
        resourceManager.addVm(migratedVMName, testPlanData.targetProject.name);

        const vmResource = await resourceManager.fetchVirtualMachine(
          page,
          migratedVMName,
          testPlanData.targetProject.name,
        );
        expect(vmResource).not.toBeNull();
        expect(vmResource?.metadata?.name).toBe(migratedVMName);
      }
    },
  );

  test.afterAll(async () => {
    await resourceManager.instantCleanup();
  });
});

/**
 * Usage Instructions:
 * 
 * 1. Before running warm migration tests, ensure VMs have no snapshots:
 *    ./cleanup-vsphere-snapshots.sh mtv-rhel8-warm-2disks2nics vs8
 * 
 * 2. If test fails due to snapshots:
 *    - Log into vSphere UI
 *    - Remove all snapshots from the VM
 *    - Run: ./reset-plan.sh <plan-name>
 *    - Re-run the test
 * 
 * 3. For CI/CD pipelines, consider:
 *    - Setting up a cleanup job that runs before tests
 *    - Using dedicated test VMs that are reset between runs
 *    - Enabling strict mode (failIfSnapshots) to catch issues early
 */

