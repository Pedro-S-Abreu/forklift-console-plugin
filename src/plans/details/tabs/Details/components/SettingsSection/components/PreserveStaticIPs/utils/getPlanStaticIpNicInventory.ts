import {
  getEffectiveStaticIpExclusions,
  getStaticIpNicRows,
  type StaticIpExclusions,
  type StaticIpNicRow,
} from 'src/plans/utils/staticIpPreservation/staticIpNicRows';

import type { ProviderVirtualMachine, V1beta1Plan } from '@forklift-ui/types';
import {
  getPlanVirtualMachines,
  getVmExcludedNicsFromStaticIPs,
} from '@utils/crds/plans/selectors';
import type { ProviderVmData } from '@utils/types';

type PlanNicInventory = {
  isComplete: boolean;
  rows: StaticIpNicRow[];
};

export const getPlanStaticIpNicInventory = (
  plan: V1beta1Plan,
  inventoryVms: ProviderVmData[],
  selectedExclusions: StaticIpExclusions = {},
): PlanNicInventory => {
  const matched = getPlanVirtualMachines(plan).map((planVm) => {
    const inventoryVm = inventoryVms.find((entry) =>
      planVm.id ? entry.vm.id === planVm.id : entry.vm.name === planVm.name,
    )?.vm;
    let key = inventoryVm?.id;
    if (planVm.name) {
      key = planVm.name;
    }
    if (planVm.id) {
      key = planVm.id;
    }

    return {
      inventoryVm,
      key,
      planVm,
    };
  });
  const vms = matched.flatMap(({ inventoryVm, key, planVm }): ProviderVirtualMachine[] =>
    inventoryVm && key ? [{ ...inventoryVm, id: key, name: planVm.name ?? inventoryVm.name }] : [],
  );
  const rows = getStaticIpNicRows(vms);
  const isComplete = matched.every(({ inventoryVm, key, planVm }) => {
    if (!inventoryVm || !key || !Array.isArray((inventoryVm as { nics?: unknown }).nics)) {
      return false;
    }

    const existing = getVmExcludedNicsFromStaticIPs(planVm) ?? [];
    const selected = selectedExclusions[key] ?? [];
    const visibleExisting = getEffectiveStaticIpExclusions(rows, { [key]: existing })[key] ?? [];
    const visibleSelected = getEffectiveStaticIpExclusions(rows, { [key]: selected })[key] ?? [];
    return visibleExisting.length === existing.length && visibleSelected.length === selected.length;
  });

  return { isComplete, rows };
};
