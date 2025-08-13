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

test.describe.serial(
  'Plans - Downstream End-to-End Migration',
  {
    tag: '@downstream',
  },
  () => {
    test.beforeEach(async ({ page }) => {
      // Only perform login if credentials are provided
      if (!process.env.CLUSTER_USERNAME || !process.env.CLUSTER_PASSWORD) {
        return;
      }

      const baseURL = process.env.BRIDGE_BASE_ADDRESS ?? process.env.BASE_ADDRESS;

      if (!baseURL) {
        throw new Error('BASE_ADDRESS is required for authentication');
      }

      try {
        // eslint-disable-next-line no-console
        console.error(`🚀 Starting login to: ${baseURL}`);
        // eslint-disable-next-line no-console
        console.error(`🔧 Environment: headless=${page.context().browser()?.browserType().name()}`);

        // Navigate with debugging
        // eslint-disable-next-line no-console
        console.error(`🌐 Navigating to: ${baseURL}`);
        
        const response = await page.goto(baseURL, { 
          waitUntil: 'networkidle',
          timeout: 60000 
        });
        
        // eslint-disable-next-line no-console
        console.error(`📄 Response status: ${response?.status()}`);
        // eslint-disable-next-line no-console
        console.error(`📄 Response URL: ${response?.url()}`);
        
        // Wait for JavaScript to execute and check if we need to retry
        let jsExecuted = false;
        let retryCount = 0;
        const maxRetries = 5;
        
        while (!jsExecuted && retryCount < maxRetries) {
          await page.waitForTimeout(2000 * (retryCount + 1)); // Progressive wait
          
          const bodyText = await page.locator('body').textContent();
          const isJsDisabledPage = bodyText?.includes('JavaScript must be enabled') || bodyText?.length < 100;
          
          if (isJsDisabledPage) {
            retryCount++;
            // eslint-disable-next-line no-console
            console.error(`⚠️ JavaScript not executing (attempt ${retryCount}/${maxRetries}), retrying...`);
            
            // Force reload to trigger JavaScript execution
            await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
          } else {
            jsExecuted = true;
            // eslint-disable-next-line no-console
            console.error(`✅ JavaScript execution confirmed after ${retryCount} retries`);
          }
        }
        
        // Final wait for any redirects after JS execution
        await page.waitForTimeout(3000);
        
        // Log page details for debugging
        const title = await page.title();
        const url = page.url();
        // eslint-disable-next-line no-console
        console.error(`📄 Page title: "${title}"`);
        // eslint-disable-next-line no-console
        console.error(`📄 Current URL: ${url}`);
        
        // Check if page content is actually loaded
        const bodyText = await page.locator('body').textContent();
        // eslint-disable-next-line no-console
        console.error(`📄 Body text length: ${bodyText?.length || 0}`);
        // eslint-disable-next-line no-console
        console.error(`📄 First 200 chars: "${bodyText?.substring(0, 200) || 'No body text'}"`);
        
        // Check for any error messages on the page
        const errorElements = await page.locator('text=/error|Error|ERROR|failed|Failed|FAILED/i').count();
        // eslint-disable-next-line no-console
        console.error(`🚨 Error elements found: ${errorElements}`);
        
        // Look for login elements before attempting login
        const usernameFields = await page.locator('input[type="text"], input[name="username"], #inputUsername').count();
        const passwordFields = await page.locator('input[type="password"], input[name="password"], #inputPassword').count();
        // eslint-disable-next-line no-console
        console.error(`🔍 Username fields found: ${usernameFields}`);
        // eslint-disable-next-line no-console
        console.error(`🔍 Password fields found: ${passwordFields}`);
        
        // List all input elements for debugging
        const allInputs = await page.locator('input').all();
        // eslint-disable-next-line no-console
        console.error(`🔍 Total input elements: ${allInputs.length}`);
        for (let i = 0; i < allInputs.length; i++) {
          const input = allInputs[i];
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          const placeholder = await input.getAttribute('placeholder');
          // eslint-disable-next-line no-console
          console.error(
            `  Input ${i}: Type="${type}", Name="${name}", ID="${id}", Placeholder="${placeholder}"`,
          );
        }
        
        // Check if we're on the right page (should contain login elements)
        if (usernameFields === 0 && passwordFields === 0) {
          // eslint-disable-next-line no-console
          console.error('⚠️ No login fields found - this might be a redirect or wrong page');
          
          // Check for common redirect patterns
          const loginLinks = await page.locator('a[href*="login"], a[href*="auth"], a[href*="oauth"]').count();
          // eslint-disable-next-line no-console
          console.error(`🔗 Login-related links found: ${loginLinks}`);
          
          // Look for any buttons that might trigger authentication
          const buttons = await page.locator('button, input[type="submit"], a').all();
          // eslint-disable-next-line no-console
          console.error(`🔘 Buttons/links found: ${buttons.length}`);
          for (let i = 0; i < Math.min(buttons.length, 5); i++) {
            const button = buttons[i];
            const text = await button.textContent();
            const href = await button.getAttribute('href');
            // eslint-disable-next-line no-console
            console.error(`  Button ${i}: "${text?.trim()}" href="${href}"`);
          }
          
          throw new Error('No login fields found on the page - this might not be the login page');
        }

        // If we have the right page, proceed with login
        if (usernameFields > 0 || passwordFields > 0) {
          const loginPage = new LoginPage(page);
          await loginPage.login(baseURL, process.env.CLUSTER_USERNAME, process.env.CLUSTER_PASSWORD);
          
          // eslint-disable-next-line no-console
          console.error('✅ Login successful');
        }
        
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ Login failed:', (error as Error).message);
        
        // Take comprehensive debugging screenshots
        await page.screenshot({
          path: './test-results/auth-failure-debug.png',
          fullPage: true,
        });
        
        // Log final page state for debugging
        try {
          const finalTitle = await page.title();
          const finalUrl = page.url();
          const finalBodyText = await page.locator('body').textContent();
          // eslint-disable-next-line no-console
          console.error(`❌ Failed on page title: "${finalTitle}"`);
          // eslint-disable-next-line no-console
          console.error(`❌ Failed on URL: ${finalUrl}`);
          // eslint-disable-next-line no-console
          console.error(`❌ Final body text length: ${finalBodyText?.length || 0}`);
        } catch (debugError) {
          // eslint-disable-next-line no-console
          console.error('❌ Could not get final page state:', (debugError as Error).message);
        }
        
        throw error;
      }
    });

    let testProviderData: ProviderData;

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
