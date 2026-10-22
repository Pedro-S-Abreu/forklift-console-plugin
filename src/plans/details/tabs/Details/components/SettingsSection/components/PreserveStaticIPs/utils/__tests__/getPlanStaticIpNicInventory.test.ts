import { describe, expect, it } from '@jest/globals';
import { PROVIDER_TYPES } from '@utils/providers/constants';

import { getPlanStaticIpNicInventory } from '../getPlanStaticIpNicInventory';

const inventoryEntry = (id: string, name: string, mac: string): never =>
  ({
    name,
    namespace: '',
    vm: {
      id,
      name,
      providerType: PROVIDER_TYPES.vsphere,
      nics: [{ mac, network: { name: 'source-net' } }],
    },
  }) as never;

describe('getPlanStaticIpNicInventory', () => {
  it('does not allow manual editing when inventory omits a plan VM', () => {
    const plan = {
      spec: {
        vms: [{ id: 'vm-1' }, { id: 'vm-2', excludeNICsFromStaticIPs: ['aa:bb:cc:dd:ee:02'] }],
      },
    } as never;
    const { isComplete, rows } = getPlanStaticIpNicInventory(plan, [
      inventoryEntry('vm-1', 'first', 'aa:bb:cc:dd:ee:01'),
    ]);

    expect(isComplete).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('keys name-only plan VMs by name and checks their excluded MACs', () => {
    const plan = {
      spec: {
        vms: [{ id: '', name: 'legacy-vm', excludeNICsFromStaticIPs: ['AA:BB:CC:DD:EE:01'] }],
      },
    } as never;
    const { isComplete, rows } = getPlanStaticIpNicInventory(plan, [
      inventoryEntry('vm-1', 'legacy-vm', 'aa:bb:cc:dd:ee:01'),
    ]);

    expect(isComplete).toBe(true);
    expect(rows[0].vmId).toBe('legacy-vm');
  });

  it('does not allow manual editing when an existing excluded NIC is missing', () => {
    const plan = {
      spec: { vms: [{ id: 'vm-1', excludeNICsFromStaticIPs: ['aa:bb:cc:dd:ee:02'] }] },
    } as never;
    const { isComplete } = getPlanStaticIpNicInventory(plan, [
      inventoryEntry('vm-1', 'first', 'aa:bb:cc:dd:ee:01'),
    ]);

    expect(isComplete).toBe(false);
  });

  it('does not drop a newly excluded NIC after inventory refresh removes it', () => {
    const plan = { spec: { vms: [{ id: 'vm-1' }] } } as never;
    const { isComplete } = getPlanStaticIpNicInventory(
      plan,
      [inventoryEntry('vm-1', 'first', 'aa:bb:cc:dd:ee:01')],
      { 'vm-1': ['aa:bb:cc:dd:ee:02'] },
    );

    expect(isComplete).toBe(false);
  });
});
