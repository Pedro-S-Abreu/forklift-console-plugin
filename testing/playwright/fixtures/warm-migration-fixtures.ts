import { test as base } from '@playwright/test';

import {
  checkVMSnapshots,
  failIfSnapshotsExist,
  logSnapshotWarning,
  refreshProviderInventory,
  type VsphereSnapshotInfo,
} from '../utils/vsphere-cleanup';

/**
 * Extended test fixture for warm migration tests
 * Automatically checks for snapshots before tests and provides warnings
 */
export const test = base.extend<{
  warmMigrationSetup: void;
  vsphereCleanup: {
    checkSnapshots: (vmName: string, providerName?: string) => Promise<VsphereSnapshotInfo>;
    failIfSnapshots: (vmName: string, providerName?: string) => Promise<void>;
    waitForCleanup: (vmName: string, providerName?: string) => Promise<void>;
  };
}>({
  warmMigrationSetup: [
    async ({}, use) => {
      console.log('🔄 Setting up warm migration test environment...');

      // Get VM name from test annotations or environment
      const vmName = process.env.WARM_TEST_VM || 'mtv-rhel8-warm-2disks2nics';
      const providerName = process.env.VSPHERE_PROVIDER_NAME || 'vs8';

      // Check for pre-existing snapshots
      try {
        const vmInfo = await checkVMSnapshots(vmName, providerName);

        if (vmInfo.hasSnapshots) {
          logSnapshotWarning(vmInfo, providerName);
          console.warn(
            '⚠️  Pre-existing snapshots detected. Test may fail if not cleaned up first.',
          );
        } else {
          console.log(`✅ VM "${vmName}" is clean - no snapshots detected`);
        }
      } catch (error) {
        console.warn(`⚠️  Could not check VM snapshots: ${error}`);
      }

      await use();

      // After test - check if snapshots were created
      console.log('🧹 Checking for snapshots created during test...');
      try {
        const vmInfo = await checkVMSnapshots(vmName, providerName);

        if (vmInfo.hasSnapshots) {
          logSnapshotWarning(vmInfo, providerName);
          console.error(
            '❌ Snapshots were created during the test. Please clean up before next run!',
          );
        }
      } catch (error) {
        console.warn(`⚠️  Could not check final snapshot status: ${error}`);
      }
    },
    { auto: true, scope: 'test' },
  ],

  vsphereCleanup: async ({}, use) => {
    const providerName = process.env.VSPHERE_PROVIDER_NAME || 'vs8';

    await use({
      checkSnapshots: async (vmName: string, provider?: string) => {
        return await checkVMSnapshots(vmName, provider || providerName);
      },

      failIfSnapshots: async (vmName: string, provider?: string) => {
        const vmInfo = await checkVMSnapshots(vmName, provider || providerName);
        failIfSnapshotsExist(vmInfo);
      },

      waitForCleanup: async (vmName: string, provider?: string) => {
        console.log(`⏳ Waiting for snapshots to be removed from "${vmName}"...`);

        // Poll for 2 minutes, checking every 10 seconds
        const maxAttempts = 12;
        const pollInterval = 10000;

        for (let i = 0; i < maxAttempts; i++) {
          if (i > 0) {
            await refreshProviderInventory(provider || providerName);
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }

          const vmInfo = await checkVMSnapshots(vmName, provider || providerName);

          if (!vmInfo.hasSnapshots) {
            console.log(`✅ Snapshots removed from "${vmName}"`);
            return;
          }

          console.log(
            `⏳ Still waiting... (${vmInfo.snapshotCount} snapshot(s) remaining, attempt ${i + 1}/${maxAttempts})`,
          );
        }

        throw new Error(
          `Timeout: Snapshots still present on "${vmName}" after ${maxAttempts * pollInterval / 1000}s`,
        );
      },
    });
  },
});

export { expect } from '@playwright/test';

