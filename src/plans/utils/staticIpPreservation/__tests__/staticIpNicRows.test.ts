import type { ProviderVirtualMachine } from '@forklift-ui/types';
import { describe, expect, it } from '@jest/globals';

import {
  getEffectiveStaticIpExclusions,
  getStaticIpNicRows,
  type StaticIpNicRow,
} from '../staticIpNicRows';

const makeVm = (
  id: string,
  details: Record<string, unknown>,
  providerType = 'vsphere',
): ProviderVirtualMachine =>
  ({ id, name: `VM ${id}`, providerType, ...details }) as unknown as ProviderVirtualMachine;

describe('getStaticIpNicRows', () => {
  it('keeps each vNIC and joins distinct manual IPs by MAC', () => {
    const vms = [
      makeVm('vm-1', {
        guestNetworks: [
          { ip: '192.0.2.10', mac: 'aa:bb:cc:dd:ee:01', origin: 'manual' },
          { ip: '192.0.2.10', mac: 'AA:BB:CC:DD:EE:01', origin: 'MANUAL' },
          { ip: '2001:db8::10', mac: 'AA:BB:CC:DD:EE:01', origin: 'manual' },
          { ip: '192.0.2.20', mac: 'AA:BB:CC:DD:EE:02', origin: 'dhcp' },
        ],
        nics: [
          { mac: 'AA:BB:CC:DD:EE:01', network: { name: 'shared-network' } },
          { mac: 'AA:BB:CC:DD:EE:02', network: { name: 'shared-network' } },
        ],
      }),
      makeVm('vm-2', {
        guestNetworks: [{ ip: '198.51.100.5', mac: 'AA:BB:CC:DD:EE:01', origin: 'manual' }],
        nics: [{ mac: 'aa:bb:cc:dd:ee:01', network: { name: 'other-network' } }],
      }),
      makeVm('ovirt-1', { nics: [{ mac: 'AA:BB:CC:DD:EE:99' }] }, 'ovirt'),
    ];

    expect(getStaticIpNicRows(vms)).toEqual([
      {
        ipAddresses: ['192.0.2.10', '2001:db8::10'],
        mac: 'AA:BB:CC:DD:EE:01',
        networkName: 'shared-network',
        vmId: 'vm-1',
        vmName: 'VM vm-1',
      },
      {
        ipAddresses: [],
        mac: 'AA:BB:CC:DD:EE:02',
        networkName: 'shared-network',
        vmId: 'vm-1',
        vmName: 'VM vm-1',
      },
      {
        ipAddresses: ['198.51.100.5'],
        mac: 'aa:bb:cc:dd:ee:01',
        networkName: 'other-network',
        vmId: 'vm-2',
        vmName: 'VM vm-2',
      },
    ]);
  });

  it('tolerates missing detail and skips NICs without a valid MAC', () => {
    const vms = [
      makeVm('summary-only', {}),
      makeVm('vm-2', {
        guestNetworks: undefined,
        nics: [
          null,
          {},
          { mac: 'aa:bb:02' },
          { mac: 'AA:BB:CC:DD:EE:02' },
          { mac: 'aa-bb-cc-dd-ee-02' },
        ],
      }),
    ];

    expect(getStaticIpNicRows(vms)).toEqual([
      {
        ipAddresses: [],
        mac: 'AA:BB:CC:DD:EE:02',
        networkName: '',
        vmId: 'vm-2',
        vmName: 'VM vm-2',
      },
    ]);
  });
});

describe('getEffectiveStaticIpExclusions', () => {
  const rows: StaticIpNicRow[] = [
    {
      ipAddresses: ['192.0.2.10'],
      mac: 'AA:BB:CC:DD:EE:01',
      networkName: 'net-1',
      vmId: 'vm-1',
      vmName: 'VM 1',
    },
    {
      ipAddresses: [],
      mac: 'AA:BB:CC:DD:EE:02',
      networkName: 'net-1',
      vmId: 'vm-1',
      vmName: 'VM 1',
    },
  ];

  it('removes stale VM/MAC selections and returns inventory MAC casing', () => {
    expect(
      getEffectiveStaticIpExclusions(rows, {
        'old-vm': ['AA:BB:CC:DD:EE:01'],
        'vm-1': ['aa-bb-cc-dd-ee-01', 'aa:bb:cc:dd:ee:01', '00:11:22:33:44:55'],
      }),
    ).toEqual({ 'vm-1': ['AA:BB:CC:DD:EE:01'] });
  });

  it('keeps the default all-selected state empty', () => {
    expect(getEffectiveStaticIpExclusions(rows, {})).toEqual({});
  });
});
