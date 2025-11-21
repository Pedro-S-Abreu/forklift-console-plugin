import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VsphereSnapshotInfo {
  vmName: string;
  vmId: string;
  snapshotCount: number;
  hasSnapshots: boolean;
}

/**
 * Check if a VM has snapshots in vSphere
 * @param vmName - Name of the VM in vSphere
 * @param providerName - Name of the provider in OpenShift (default: 'vs8')
 * @param namespace - Namespace where provider is deployed (default: 'openshift-mtv')
 * @returns Promise<VsphereSnapshotInfo>
 */
export async function checkVMSnapshots(
  vmName: string,
  providerName = 'vs8',
  namespace = 'openshift-mtv',
): Promise<VsphereSnapshotInfo> {
  try {
    // Get provider UID
    const { stdout: providerUid } = await execAsync(
      `oc get provider ${providerName} -n ${namespace} -o jsonpath='{.metadata.uid}'`,
    );

    if (!providerUid) {
      throw new Error(`Provider ${providerName} not found`);
    }

    // Get inventory route
    const { stdout: inventoryRoute } = await execAsync(
      `oc get route forklift-inventory -n ${namespace} -o jsonpath='{.spec.host}'`,
    );

    if (!inventoryRoute) {
      throw new Error('Forklift inventory route not found');
    }

    // Get auth token
    const { stdout: token } = await execAsync('oc whoami -t');

    // Query VM data
    const curlCmd = `curl -sk -H "Authorization: Bearer ${token.trim()}" "https://${inventoryRoute}/providers/vsphere/${providerUid.trim()}/vms" | jq -r '.[] | select(.name == "${vmName}") | {name: .name, id: .id, snapshots: (.snapshots // [])}'`;

    const { stdout: vmDataJson } = await execAsync(curlCmd);

    if (!vmDataJson || vmDataJson.trim() === '') {
      throw new Error(`VM ${vmName} not found in provider inventory`);
    }

    const vmData = JSON.parse(vmDataJson);

    return {
      vmName: vmData.name,
      vmId: vmData.id,
      snapshotCount: vmData.snapshots ? vmData.snapshots.length : 0,
      hasSnapshots: vmData.snapshots && vmData.snapshots.length > 0,
    };
  } catch (error) {
    console.error(`Error checking VM snapshots: ${error}`);
    throw error;
  }
}

/**
 * Check multiple VMs for snapshots
 */
export async function checkMultipleVMSnapshots(
  vmNames: string[],
  providerName = 'vs8',
  namespace = 'openshift-mtv',
): Promise<VsphereSnapshotInfo[]> {
  const results: VsphereSnapshotInfo[] = [];

  for (const vmName of vmNames) {
    try {
      const info = await checkVMSnapshots(vmName, providerName, namespace);
      results.push(info);
    } catch (error) {
      console.error(`Error checking VM ${vmName}: ${error}`);
      results.push({
        vmName,
        vmId: '',
        snapshotCount: -1,
        hasSnapshots: false,
      });
    }
  }

  return results;
}

/**
 * Refresh provider inventory to pick up snapshot changes
 */
export async function refreshProviderInventory(
  providerName = 'vs8',
  namespace = 'openshift-mtv',
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    await execAsync(
      `oc annotate provider ${providerName} -n ${namespace} forklift.konveyor.io/refreshed-at="${timestamp}" --overwrite`,
    );
    console.log(`✅ Provider ${providerName} inventory refresh triggered`);

    // Wait for inventory to refresh
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error(`Error refreshing provider inventory: ${error}`);
    throw error;
  }
}

/**
 * Display warning about snapshots and provide cleanup instructions
 */
export function logSnapshotWarning(vmInfo: VsphereSnapshotInfo, providerName = 'vs8'): void {
  if (!vmInfo.hasSnapshots) {
    return;
  }

  console.warn(`
⚠️  WARNING: VM "${vmInfo.vmName}" has ${vmInfo.snapshotCount} snapshot(s)
   
   This will prevent warm migration from working!
   
   To fix:
   1. Log into vSphere vCenter
   2. Find VM: ${vmInfo.vmName}
   3. Right-click → Snapshots → Manage Snapshots
   4. Delete ALL snapshots
   
   Or run: ./cleanup-vsphere-snapshots.sh ${vmInfo.vmName} ${providerName}
`);
}

/**
 * Fail the test if snapshots are detected
 */
export function failIfSnapshotsExist(vmInfo: VsphereSnapshotInfo): void {
  if (vmInfo.hasSnapshots) {
    throw new Error(
      `VM "${vmInfo.vmName}" has ${vmInfo.snapshotCount} pre-existing snapshot(s). ` +
        `Remove snapshots before running warm migration tests.`,
    );
  }
}

/**
 * Wait for snapshots to be removed (with timeout)
 */
export async function waitForSnapshotsRemoved(
  vmName: string,
  providerName = 'vs8',
  namespace = 'openshift-mtv',
  timeoutMs = 60000,
  pollIntervalMs = 5000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await refreshProviderInventory(providerName, namespace);

    const vmInfo = await checkVMSnapshots(vmName, providerName, namespace);

    if (!vmInfo.hasSnapshots) {
      console.log(`✅ VM "${vmName}" has no snapshots - ready for warm migration`);
      return;
    }

    console.log(
      `⏳ VM "${vmName}" still has ${vmInfo.snapshotCount} snapshot(s). Waiting...`,
    );
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timeout: VM "${vmName}" still has snapshots after ${timeoutMs}ms. Manual cleanup required.`,
  );
}

