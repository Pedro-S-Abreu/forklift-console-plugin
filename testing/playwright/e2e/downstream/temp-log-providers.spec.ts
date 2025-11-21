import { existsSync } from 'fs';
import { join } from 'path';

import { test } from '@playwright/test';

const providersPath = join(__dirname, '../../../.providers.json');
if (!existsSync(providersPath)) {
  throw new Error(`.providers.json file not found at: ${providersPath}`);
}

import * as providers from '../../../.providers.json';

/**
 * Redacts sensitive fields from provider configuration
 */
function redactSecrets(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }

  const redacted = { ...obj };
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'api_key',
    'apiKey',
    'guest_vm_linux_password',
    'guest_vm_win_password',
  ];

  for (const key of Object.keys(redacted)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = redacted[key] ? '***REDACTED***' : '';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSecrets(redacted[key]);
    }
  }

  return redacted;
}

test.describe('Temporary Provider Configuration Logger', () => {
  test('Log provider configuration without secrets', async () => {
    console.log('\n========================================');
    console.log('PROVIDER CONFIGURATION (SECRETS REDACTED)');
    console.log('========================================\n');

    const redactedProviders = redactSecrets(providers);

    console.log(JSON.stringify(redactedProviders, null, 2));

    console.log('\n========================================');
    console.log('Available Provider Keys:');
    console.log(Object.keys(providers).join(', '));
    console.log('========================================\n');

    // Log individual provider details
    for (const [providerKey, providerConfig] of Object.entries(providers)) {
      console.log(`\n--- ${providerKey} ---`);
      console.log(`Type: ${(providerConfig as any).type}`);
      console.log(`Version: ${(providerConfig as any).version || 'N/A'}`);
      console.log(`FQDN: ${(providerConfig as any).fqdn || 'N/A'}`);
      console.log(`API URL: ${(providerConfig as any).api_url || 'N/A'}`);
      console.log(`Username: ${(providerConfig as any).username || 'N/A'}`);
      console.log(`Password: ${(providerConfig as any).password ? '***REDACTED***' : 'N/A'}`);
      
      // Additional fields based on provider type
      const config = providerConfig as any;
      if (config.endpoint_type) {
        console.log(`Endpoint Type: ${config.endpoint_type}`);
      }
      if (config.vddk_init_image) {
        console.log(`VDDK Init Image: ${config.vddk_init_image}`);
      }
      if (config.user_domain_name) {
        console.log(`User Domain: ${config.user_domain_name}`);
      }
      if (config.project_name) {
        console.log(`Project: ${config.project_name}`);
      }
      if (config.region_name) {
        console.log(`Region: ${config.region_name}`);
      }
      if (config.guest_vm_linux_user) {
        console.log(`Guest VM Linux User: ${config.guest_vm_linux_user}`);
        console.log(`Guest VM Linux Password: ***REDACTED***`);
      }
      if (config.guest_vm_win_user) {
        console.log(`Guest VM Windows User: ${config.guest_vm_win_user}`);
        console.log(`Guest VM Windows Password: ***REDACTED***`);
      }
    }

    console.log('\n========================================');
    console.log('END OF PROVIDER CONFIGURATION');
    console.log('========================================\n');
  });
});

