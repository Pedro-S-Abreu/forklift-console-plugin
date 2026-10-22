import type { ProviderVirtualMachine } from 'src/plans/create/types';

import { describe, expect, it } from '@jest/globals';

import { StaticIpSelectionMode } from '../../steps/other-settings/constants';
import { buildPlanSpecVms } from '../buildPlanSpecVms';

const MOCK_VM_ID = 'vm-1';
const MOCK_INSTANCE_TYPE = 'cx1.2xlarge';

const createMockVm = (overrides: Partial<ProviderVirtualMachine> = {}): ProviderVirtualMachine =>
  ({
    id: MOCK_VM_ID,
    name: 'test-vm',
    providerType: 'vsphere',
    ...overrides,
  }) as unknown as ProviderVirtualMachine;

describe('buildPlanSpecVms', () => {
  it('applies instance type to a VM when provided', () => {
    const vms = [createMockVm({ id: MOCK_VM_ID })];

    const result = buildPlanSpecVms({
      instanceTypes: { [MOCK_VM_ID]: MOCK_INSTANCE_TYPE },
      vms,
    });

    expect(result[0].instanceType).toBe(MOCK_INSTANCE_TYPE);
  });

  it('does not set instance type when not provided for a VM', () => {
    const vms = [createMockVm({ id: MOCK_VM_ID }), createMockVm({ id: 'vm-2', name: 'other-vm' })];

    const result = buildPlanSpecVms({
      instanceTypes: { [MOCK_VM_ID]: MOCK_INSTANCE_TYPE },
      vms,
    });

    expect(result[0].instanceType).toBe(MOCK_INSTANCE_TYPE);
    expect(result[1].instanceType).toBeUndefined();
  });

  it('does not set instance type when instanceTypes map is undefined', () => {
    const vms = [createMockVm()];

    const result = buildPlanSpecVms({ vms });

    expect(result[0].instanceType).toBeUndefined();
  });

  it('does not set instance type when instanceTypes map is empty', () => {
    const vms = [createMockVm()];

    const result = buildPlanSpecVms({ instanceTypes: {}, vms });

    expect(result[0].instanceType).toBeUndefined();
  });

  it('stores exclusions on only the selected VM, even when VMs share a network', () => {
    const vms = [
      {
        ...createMockVm({ id: 'vm-1', name: 'first' }),
        nics: [
          { mac: 'aa:bb:cc:00:00:01', network: { id: 'network-1' } },
          { mac: 'aa:bb:cc:00:00:02', network: { id: 'network-1' } },
        ],
      },
      {
        ...createMockVm({ id: 'vm-2', name: 'second' }),
        nics: [{ mac: 'aa:bb:cc:00:00:03', network: { id: 'network-1' } }],
      },
    ] as unknown as ProviderVirtualMachine[];

    const result = buildPlanSpecVms({
      excludedNicsFromStaticIPs: {
        'vm-1': ['AA:BB:CC:00:00:02', 'stale-mac'],
        'removed-vm': ['aa:bb:cc:00:00:03'],
      },
      preserveStaticIps: true,
      staticIpSelectionMode: StaticIpSelectionMode.Manual,
      vms,
    });

    expect(result[0]).toEqual(
      expect.objectContaining({ excludeNICsFromStaticIPs: ['aa:bb:cc:00:00:02'] }),
    );
    expect(result[1]).not.toHaveProperty('excludeNICsFromStaticIPs');
  });

  it('omits vNIC exclusions when preservation is off or all vNICs are selected', () => {
    const vm = {
      ...createMockVm(),
      nics: [{ mac: 'aa:bb:cc:00:00:01' }],
    } as unknown as ProviderVirtualMachine;
    const params = {
      excludedNicsFromStaticIPs: { [vm.id]: ['aa:bb:cc:00:00:01'] },
      vms: [vm],
    };

    expect(
      buildPlanSpecVms({
        ...params,
        preserveStaticIps: false,
        staticIpSelectionMode: StaticIpSelectionMode.Manual,
      })[0],
    ).not.toHaveProperty('excludeNICsFromStaticIPs');
    expect(
      buildPlanSpecVms({
        ...params,
        preserveStaticIps: true,
        staticIpSelectionMode: StaticIpSelectionMode.All,
      })[0],
    ).not.toHaveProperty('excludeNICsFromStaticIPs');
  });
});
