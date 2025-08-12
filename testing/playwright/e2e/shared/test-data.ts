export interface PlanTestData {
  planName: string;
  planProject: string;
  sourceProvider: string;
  targetProvider: string;
  targetProject: string;
  networkMap: {
    name: string;
    exists: boolean;
  };
  storageMap: {
    name: string;
    exists: boolean;
  };
}

/**
 * Helper to create plan test data with proper typing
 */
export const createPlanTestData = ({
  planName,
  planProject,
  sourceProvider,
  targetProvider,
  targetProject,
  networkMap,
  storageMap,
}: PlanTestData): PlanTestData => ({
  planName,
  planProject,
  sourceProvider,
  targetProvider,
  targetProject,
  networkMap,
  storageMap,
});

export interface ProviderData {
  name: string;
  type: 'vsphere' | 'ovirt' | 'ova' | 'openstack';
  hostname: string;
  username: string;
  password?: string;
  fingerprint?: string;
  vddkInitImage?: string;
}
