import type { ProviderVirtualMachine } from '@forklift-ui/types';
import { PROVIDER_TYPES } from '@utils/providers/constants';

export type StaticIpNicRow = {
  ipAddresses: string[];
  mac: string;
  networkName: string;
  vmId: string;
  vmName: string;
};

export type StaticIpExclusions = Record<string, string[]>;

const MAC_PATTERN = /^(?:[0-9a-f]{12}|(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2})$/iu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeMac = (mac: string): string =>
  mac.toLowerCase().replaceAll(':', '').replaceAll('-', '');

const getManualIpAddressesByMac = (vm: Record<string, unknown>): Map<string, string[]> => {
  const addressesByMac = new Map<string, string[]>();

  for (const guestNetwork of asArray(vm.guestNetworks)) {
    if (
      isRecord(guestNetwork) &&
      isNonEmptyString(guestNetwork.mac) &&
      isNonEmptyString(guestNetwork.ip) &&
      isNonEmptyString(guestNetwork.origin) &&
      guestNetwork.origin.toLowerCase() === 'manual'
    ) {
      const mac = normalizeMac(guestNetwork.mac);
      const { ip } = guestNetwork;
      const addresses = addressesByMac.get(mac) ?? [];
      if (!addresses.some((address) => address.toLowerCase() === ip.toLowerCase())) {
        addresses.push(ip);
        addressesByMac.set(mac, addresses);
      }
    }
  }

  return addressesByMac;
};

export const getStaticIpNicRows = (vms: ProviderVirtualMachine[]): StaticIpNicRow[] => {
  const rows: StaticIpNicRow[] = [];

  for (const vm of vms) {
    if (vm.providerType === PROVIDER_TYPES.vsphere && isRecord(vm)) {
      const addressesByMac = getManualIpAddressesByMac(vm);
      const seenMacs = new Set<string>();

      for (const nic of asArray(vm.nics)) {
        if (
          isRecord(nic) &&
          isNonEmptyString(nic.mac) &&
          MAC_PATTERN.test(nic.mac) &&
          !seenMacs.has(normalizeMac(nic.mac))
        ) {
          const normalizedMac = normalizeMac(nic.mac);
          seenMacs.add(normalizedMac);

          const networkName = isRecord(nic.network) ? nic.network.name : undefined;
          rows.push({
            ipAddresses: addressesByMac.get(normalizedMac) ?? [],
            mac: nic.mac,
            networkName: isNonEmptyString(networkName) ? networkName : '',
            vmId: vm.id,
            vmName: vm.name,
          });
        }
      }
    }
  }

  return rows;
};

export const getEffectiveStaticIpExclusions = (
  rows: StaticIpNicRow[],
  exclusions: StaticIpExclusions,
): StaticIpExclusions => {
  const selectedByVm = new Map(
    Object.entries(exclusions).map(([vmId, macs]) => [vmId, new Set(macs.map(normalizeMac))]),
  );
  const effective: StaticIpExclusions = {};

  for (const row of rows) {
    const normalizedMac = normalizeMac(row.mac);
    if (selectedByVm.get(row.vmId)?.has(normalizedMac)) {
      const vmMacs = effective[row.vmId] ?? [];
      if (!vmMacs.some((mac) => normalizeMac(mac) === normalizedMac)) {
        effective[row.vmId] = [...vmMacs, row.mac];
      }
    }
  }

  return effective;
};
