import {
  type IoK8sApiCoreV1ConfigMap,
  PlanModel,
  type ProviderVirtualMachine,
  type V1beta1Hook,
  type V1beta1NetworkMap,
  type V1beta1Plan,
  type V1beta1PlanSpecTransferNetwork,
  type V1beta1PlanSpecVmsLuks,
  type V1beta1Provider,
  type V1beta1StorageMap,
} from '@forklift-ui/types';
import { k8sCreate } from '@openshift-console/dynamic-plugin-sdk';
import { getObjectRef, type ObjectRef } from '@utils/helpers/getObjectRef';
import type { TargetPowerStateValue } from '@utils/plans/constants';

import { MigrationTypeValue } from '../steps/migration-type/constants';
import type { StaticIpSelectionMode } from '../steps/other-settings/constants';

import { buildPlanSpecVms } from './buildPlanSpecVms';

type CreatePlanParams = {
  customScriptsConfigMap?: IoK8sApiCoreV1ConfigMap;
  excludedNicsFromStaticIPs?: Record<string, string[]>;
  instanceTypes?: Record<string, string>;
  luks?: V1beta1PlanSpecVmsLuks;
  migrateSharedDisks?: boolean;
  migrationType: MigrationTypeValue;
  nbdeClevis?: boolean;
  networkMap: V1beta1NetworkMap;
  planDescription?: string;
  planName: string;
  planProject: string;
  postHook?: V1beta1Hook;
  preHook?: V1beta1Hook;
  preserveStaticIps?: boolean;
  rootDevice?: string;
  sourceProvider: V1beta1Provider | undefined;
  staticIpSelectionMode?: StaticIpSelectionMode;
  storageMap: V1beta1StorageMap;
  targetPowerState: TargetPowerStateValue;
  targetProject: string;
  targetProvider: V1beta1Provider | undefined;
  transferNetwork?: V1beta1PlanSpecTransferNetwork;
  vms: ProviderVirtualMachine[];
};

/**
 * Constructs and creates a Plan custom resource from input params.
 * Connects providers, maps, transfer networks, hooks, and selected VMs.
 */
export const createPlan = async ({
  customScriptsConfigMap,
  excludedNicsFromStaticIPs,
  instanceTypes,
  luks,
  migrateSharedDisks,
  migrationType,
  nbdeClevis,
  networkMap,
  planDescription,
  planName,
  planProject,
  postHook,
  preHook,
  preserveStaticIps,
  rootDevice,
  sourceProvider,
  staticIpSelectionMode,
  storageMap,
  targetPowerState,
  targetProject,
  targetProvider,
  transferNetwork,
  vms,
}: CreatePlanParams): Promise<ObjectRef> => {
  const plan: V1beta1Plan = {
    apiVersion: 'forklift.konveyor.io/v1beta1',
    kind: 'Plan',
    metadata: {
      name: planName,
      namespace: planProject,
    },
    spec: {
      ...(customScriptsConfigMap && {
        customizationScripts: {
          name: customScriptsConfigMap.metadata?.name,
          namespace: customScriptsConfigMap.metadata?.namespace,
        },
      }),
      ...(planDescription ? { description: planDescription } : {}),
      map: {
        network: getObjectRef(networkMap),
        storage: getObjectRef(storageMap),
      },
      migrateSharedDisks,
      preserveStaticIPs: preserveStaticIps,
      provider: {
        destination: getObjectRef(targetProvider),
        source: getObjectRef(sourceProvider),
      },
      targetNamespace: targetProject,
      ...(transferNetwork && { transferNetwork }),
      targetPowerState,
      type: migrationType,
      vms: buildPlanSpecVms({
        excludedNicsFromStaticIPs,
        instanceTypes,
        luks,
        nbdeClevis,
        postHook,
        preHook,
        preserveStaticIps,
        rootDevice,
        staticIpSelectionMode,
        vms,
      }),
      warm: migrationType === MigrationTypeValue.Warm,
    },
  };

  const createdPlan = await k8sCreate({
    data: plan,
    model: PlanModel,
  });

  return getObjectRef(createdPlan);
};
