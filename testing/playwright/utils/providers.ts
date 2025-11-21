import { existsSync } from 'node:fs';
import { join } from 'node:path';

import * as providers from '../../.providers.json';
import type { ProviderConfig, ProviderData } from '../types/test-data';

import { MTV_NAMESPACE } from './resource-manager/constants';

const providersPath = join(__dirname, '../../.providers.json');
if (!existsSync(providersPath)) {
  throw new Error(`.providers.json file not found at: ${providersPath}`);
}

/**
 * Get provider configuration from .providers.json
 */
export const getProviderConfig = (providerKey: string): ProviderConfig => {
  const providerConfig = (providers as Record<string, ProviderConfig>)[providerKey];

  if (!providerConfig) {
    throw new Error(`Provider configuration not found for key: ${providerKey}`);
  }

  return providerConfig;
};

/**
 * Create OpenStack provider test data with proper defaults
 */
const createOpenstackProvider = (overrides: Partial<ProviderData> = {}): ProviderData => {
  const providerKey = process.env.OPENSTACK_PROVIDER ?? 'openstack-default';
  const providerConfig = getProviderConfig(providerKey);
  const uniqueId = crypto.randomUUID().slice(0, 8);

  const defaults: ProviderData = {
    name: `test-openstack-provider-${uniqueId}`,
    projectName: MTV_NAMESPACE,
    type: providerConfig.type,
    hostname: providerConfig.api_url,
    username: providerConfig.username,
    password: providerConfig.password,
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Create OVA provider test data with proper defaults
 */
const createOvaProvider = (overrides: Partial<ProviderData> = {}): ProviderData => {
  const providerKey = process.env.OVA_PROVIDER ?? 'ova-default';
  const providerConfig = getProviderConfig(providerKey);
  const uniqueId = crypto.randomUUID().slice(0, 8);

  const defaults: ProviderData = {
    name: `test-ova-provider-${uniqueId}`,
    projectName: MTV_NAMESPACE,
    type: providerConfig.type,
    hostname: providerConfig.api_url,
    username: providerConfig.username,
    password: providerConfig.password,
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Create oVirt provider test data with proper defaults
 */
const createOvirtProvider = (overrides: Partial<ProviderData> = {}): ProviderData => {
  const providerKey = process.env.OVIRT_PROVIDER ?? 'ovirt-4.4.9';
  const providerConfig = getProviderConfig(providerKey);
  const uniqueId = crypto.randomUUID().slice(0, 8);

  const defaults: ProviderData = {
    name: `test-ovirt-provider-${uniqueId}`,
    projectName: MTV_NAMESPACE,
    type: providerConfig.type,
    hostname: providerConfig.api_url,
    username: providerConfig.username,
    password: providerConfig.password,
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Create vSphere provider test data with proper defaults
 */
const createVsphereProvider = (overrides: Partial<ProviderData> = {}): ProviderData => {
  const providerKey = process.env.VSPHERE_PROVIDER ?? 'vsphere-8.0.1';
  const providerConfig = getProviderConfig(providerKey);
  const uniqueId = crypto.randomUUID().slice(0, 8);

  const defaults: ProviderData = {
    name: `test-vsphere-provider-${uniqueId}`,
    projectName: MTV_NAMESPACE,
    type: providerConfig.type,
    endpointType: providerConfig.endpoint_type ?? 'vcenter',
    hostname: providerConfig.api_url,
    username: providerConfig.username,
    password: providerConfig.password,
    vddkInitImage: providerConfig.vddk_init_image,
    useVddkAioOptimization: false,
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Factory for creating provider test data based on provider type
 * @param providerType - Type of provider to create
 * @param overrides - Optional overrides for provider data
 * @returns ProviderData with proper defaults for the provider type
 */
export const createProviderData = (
  providerType: 'vsphere' | 'ovirt' | 'openstack' | 'ova',
  overrides: Partial<ProviderData> = {},
): ProviderData => {
  switch (providerType) {
    case 'openstack':
      return createOpenstackProvider(overrides);
    case 'ova':
      return createOvaProvider(overrides);
    case 'ovirt':
      return createOvirtProvider(overrides);
    case 'vsphere':
      return createVsphereProvider(overrides);
    default:
      throw new Error(`Unsupported provider type: ${providerType as string}`);
  }
};
