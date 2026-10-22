import type {
  ProviderVirtualMachine,
  V1beta1Hook,
  V1beta1PlanSpecVms,
  V1beta1PlanSpecVmsHooks,
  V1beta1PlanSpecVmsLuks,
} from '@forklift-ui/types';
import { getName, getNamespace } from '@utils/crds/common/selectors';
import { isEmpty } from '@utils/helpers';
import { PROVIDER_TYPES } from '@utils/providers/constants';

import {
  getEffectiveStaticIpExclusions,
  getStaticIpNicRows,
} from '../../utils/staticIpPreservation/staticIpNicRows';
import { StaticIpSelectionMode } from '../steps/other-settings/constants';

type PlanSpecVmsParams = {
  excludedNicsFromStaticIPs?: Record<string, string[]>;
  instanceTypes?: Record<string, string>;
  luks?: V1beta1PlanSpecVmsLuks;
  nbdeClevis?: boolean;
  postHook?: V1beta1Hook;
  preHook?: V1beta1Hook;
  preserveStaticIps?: boolean;
  rootDevice?: string;
  staticIpSelectionMode?: StaticIpSelectionMode;
  vms: ProviderVirtualMachine[];
};

/**
 * Builds an array of V1beta1PlanSpecVms for inclusion in a Plan spec.
 * Adds pre/post hooks, root disk info, LUKS config, and namespace (if OpenShift).
 */
export const buildPlanSpecVms = ({
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
}: PlanSpecVmsParams): V1beta1PlanSpecVms[] => {
  const exclusions =
    preserveStaticIps && staticIpSelectionMode === StaticIpSelectionMode.Manual
      ? getEffectiveStaticIpExclusions(getStaticIpNicRows(vms), excludedNicsFromStaticIPs ?? {})
      : {};

  return vms.map((vm) => {
    const hooks: V1beta1PlanSpecVmsHooks[] = [];
    const preHookName = getName(preHook);
    const preHookNamespace = getNamespace(preHook);

    if (preHookName && preHookNamespace) {
      hooks.push({
        hook: {
          name: preHookName,
          namespace: preHookNamespace,
        },
        step: 'PreHook',
      });
    }

    const postHookName = getName(postHook);
    const postHookNamespace = getNamespace(postHook);

    if (postHookName && postHookNamespace) {
      hooks.push({
        hook: {
          name: postHookName,
          namespace: postHookNamespace,
        },
        step: 'PostHook',
      });
    }

    return {
      id: vm.id,
      name: vm.name,
      ...(vm.providerType === PROVIDER_TYPES.openshift && { namespace: vm.namespace }),
      ...(instanceTypes?.[vm.id] && { instanceType: instanceTypes[vm.id] }),
      ...(rootDevice && { rootDisk: rootDevice }),
      ...(luks && { luks }),
      ...(nbdeClevis && { nbdeClevis }),
      ...(exclusions[vm.id]?.length && { excludeNICsFromStaticIPs: exclusions[vm.id] }),
      ...(!isEmpty(hooks) && { hooks }),
    };
  });
};
