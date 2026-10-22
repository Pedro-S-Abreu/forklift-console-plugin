import { StaticIpSelectionMode } from 'src/plans/create/steps/other-settings/constants';
import {
  getEffectiveStaticIpExclusions,
  type StaticIpExclusions,
  type StaticIpNicRow,
} from 'src/plans/utils/staticIpPreservation/staticIpNicRows';

import { ADD, REMOVE, REPLACE } from '@components/ModalForm/utils/constants';
import { PlanModel, type V1beta1Plan } from '@forklift-ui/types';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import {
  getPlanVirtualMachines,
  getVmExcludedNicsFromStaticIPs,
} from '@utils/crds/plans/selectors';
import { isEmpty } from '@utils/helpers';

type PatchOperation = {
  op: typeof ADD | typeof REMOVE | typeof REPLACE | 'test';
  path: string;
  value?: boolean | string | string[];
};

const getPlanVmKey = (vm: { id?: string; name?: string }): string | undefined => {
  if (vm.id) {
    return vm.id;
  }
  return vm.name;
};

export const getPlanNicExclusions = (plan: V1beta1Plan): StaticIpExclusions =>
  Object.fromEntries(
    getPlanVirtualMachines(plan).flatMap((vm) => {
      const excluded = getVmExcludedNicsFromStaticIPs(vm);
      const key = getPlanVmKey(vm);
      return key && excluded?.length ? [[key, excluded]] : [];
    }),
  );

export const onConfirmPreserveStaticIPs = async ({
  exclusions = {},
  newValue,
  resource,
  rows = [],
  selectionMode = StaticIpSelectionMode.All,
}: {
  exclusions?: StaticIpExclusions;
  newValue: boolean;
  resource: V1beta1Plan;
  rows?: StaticIpNicRow[];
  selectionMode?: StaticIpSelectionMode;
}): Promise<V1beta1Plan> => {
  const current = resource?.spec?.preserveStaticIPs;
  const data: PatchOperation[] = [];

  if (current !== newValue) {
    data.push({
      op: current === undefined ? ADD : REPLACE,
      path: '/spec/preserveStaticIPs',
      value: newValue,
    });
  }

  if (newValue) {
    const effectiveExclusions =
      selectionMode === StaticIpSelectionMode.Manual
        ? getEffectiveStaticIpExclusions(rows, exclusions)
        : {};

    for (const [index, vm] of getPlanVirtualMachines(resource).entries()) {
      const currentMacs = getVmExcludedNicsFromStaticIPs(vm);
      const key = getPlanVmKey(vm);
      const nextMacs = key ? (effectiveExclusions[key] ?? []) : [];
      const unchanged =
        currentMacs?.length === nextMacs.length &&
        currentMacs?.every((mac) => nextMacs.includes(mac));
      const shouldPatch = !unchanged && (!isEmpty(nextMacs) || currentMacs !== undefined);

      if (shouldPatch) {
        const path = `/spec/vms/${index}/excludeNICsFromStaticIPs`;
        if (vm.id) {
          data.push({ op: 'test', path: `/spec/vms/${index}/id`, value: vm.id });
        } else if (vm.name) {
          data.push({ op: 'test', path: `/spec/vms/${index}/name`, value: vm.name });
        }

        if (isEmpty(nextMacs)) {
          data.push({ op: REMOVE, path });
        } else {
          data.push({ op: currentMacs === undefined ? ADD : REPLACE, path, value: nextMacs });
        }
      }
    }
  }

  if (isEmpty(data)) {
    return resource;
  }

  const result = await k8sPatch({
    data,
    model: PlanModel,
    resource,
  });

  return result;
};
