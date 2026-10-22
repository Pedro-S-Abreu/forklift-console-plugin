import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockK8sPatch = jest.fn((..._args: unknown[]) => Promise.resolve({}));

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  k8sPatch: (...args: unknown[]): unknown =>
    (mockK8sPatch as (...a: unknown[]) => unknown)(...args),
}));

import { StaticIpSelectionMode } from 'src/plans/create/steps/other-settings/constants';

import { PlanModel } from '@forklift-ui/types';

import { getPlanNicExclusions, onConfirmPreserveStaticIPs } from '../utils';

describe('PreserveStaticIPs utils - confirm', () => {
  beforeEach(() => {
    mockK8sPatch.mockReset();
    mockK8sPatch.mockResolvedValue({});
  });

  it('ADDs preserveStaticIPs with true', async () => {
    const resource = { metadata: { name: 'p' }, spec: {} } as never;

    await onConfirmPreserveStaticIPs({ newValue: true, resource });

    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [{ op: 'add', path: '/spec/preserveStaticIPs', value: true }],
      model: PlanModel,
      resource,
    });
  });

  it('REPLACEs preserveStaticIPs keeping false', async () => {
    const resource = {
      metadata: { name: 'p' },
      spec: {
        preserveStaticIPs: true,
        vms: [{ id: 'vm-1', excludeNICsFromStaticIPs: ['aa:bb:cc:dd:ee:01'] }],
      },
    } as never;

    await onConfirmPreserveStaticIPs({ newValue: false, resource });

    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [{ op: 'replace', path: '/spec/preserveStaticIPs', value: false }],
      model: PlanModel,
      resource,
    });
  });

  it('adds a manual exclusion only to the matching VM', async () => {
    const resource = {
      metadata: { name: 'p' },
      spec: {
        preserveStaticIPs: true,
        vms: [{ id: 'vm-1' }, { id: 'vm-2' }],
      },
    } as never;

    await onConfirmPreserveStaticIPs({
      exclusions: { 'vm-1': ['AA:BB:CC:DD:EE:01', 'stale-mac'] },
      newValue: true,
      resource,
      rows: [
        {
          vmId: 'vm-1',
          vmName: 'first',
          mac: 'aa:bb:cc:dd:ee:01',
          networkName: 'network-1',
          ipAddresses: [],
        },
      ],
      selectionMode: StaticIpSelectionMode.Manual,
    });

    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [
        { op: 'test', path: '/spec/vms/0/id', value: 'vm-1' },
        {
          op: 'add',
          path: '/spec/vms/0/excludeNICsFromStaticIPs',
          value: ['aa:bb:cc:dd:ee:01'],
        },
      ],
      model: PlanModel,
      resource,
    });
  });

  it('removes existing per-vNIC exclusions when all vNICs are selected', async () => {
    const resource = {
      metadata: { name: 'p' },
      spec: {
        preserveStaticIPs: true,
        vms: [{ id: 'vm-1', excludeNICsFromStaticIPs: ['aa:bb:cc:dd:ee:01'] }],
      },
    } as never;

    expect(getPlanNicExclusions(resource)).toEqual({ 'vm-1': ['aa:bb:cc:dd:ee:01'] });
    await onConfirmPreserveStaticIPs({ newValue: true, resource });

    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [
        { op: 'test', path: '/spec/vms/0/id', value: 'vm-1' },
        { op: 'remove', path: '/spec/vms/0/excludeNICsFromStaticIPs' },
      ],
      model: PlanModel,
      resource,
    });
  });

  it('does not patch when neither the plan setting nor vNIC selections changed', async () => {
    const resource = { metadata: { name: 'p' }, spec: { preserveStaticIPs: true } } as never;

    await expect(onConfirmPreserveStaticIPs({ newValue: true, resource })).resolves.toBe(resource);
    expect(mockK8sPatch).not.toHaveBeenCalled();
  });

  it('keeps exclusions when global preservation is already disabled', async () => {
    const resource = {
      spec: {
        preserveStaticIPs: false,
        vms: [{ id: 'vm-1', excludeNICsFromStaticIPs: ['aa:bb:cc:dd:ee:01'] }],
      },
    } as never;

    await expect(onConfirmPreserveStaticIPs({ newValue: false, resource })).resolves.toBe(resource);
    expect(mockK8sPatch).not.toHaveBeenCalled();
  });

  it('preserves name-only Plan VM exclusions with a name guard', async () => {
    const resource = {
      metadata: { name: 'p' },
      spec: {
        preserveStaticIPs: true,
        vms: [{ id: '', name: 'legacy-vm', excludeNICsFromStaticIPs: ['aa:bb:cc:dd:ee:01'] }],
      },
    } as never;
    const rows = [
      {
        vmId: 'legacy-vm',
        vmName: 'legacy-vm',
        mac: 'aa:bb:cc:dd:ee:01',
        networkName: 'source-net',
        ipAddresses: [],
      },
    ];

    expect(getPlanNicExclusions(resource)).toEqual({ 'legacy-vm': ['aa:bb:cc:dd:ee:01'] });
    await onConfirmPreserveStaticIPs({
      exclusions: { 'legacy-vm': ['aa:bb:cc:dd:ee:01'] },
      newValue: true,
      resource,
      rows,
      selectionMode: StaticIpSelectionMode.Manual,
    });

    expect(mockK8sPatch).not.toHaveBeenCalled();

    await onConfirmPreserveStaticIPs({ newValue: true, resource });
    expect(mockK8sPatch).toHaveBeenCalledWith({
      data: [
        { op: 'test', path: '/spec/vms/0/name', value: 'legacy-vm' },
        { op: 'remove', path: '/spec/vms/0/excludeNICsFromStaticIPs' },
      ],
      model: PlanModel,
      resource,
    });
  });
});
