# Playwright Test Fixtures Guide

This guide explains how to use the test fixtures available in the Forklift Console Plugin test suite.

## Overview

Fixtures in Playwright provide a way to set up test environments and share common setup logic across tests. Our custom fixtures handle provider and plan creation/cleanup automatically.

## Available Fixture Configurations

### 1. `sharedProviderFixtures`

**Use case:** Multiple tests that need the same provider but different plans.

**Scope:**
- Provider: Worker scope (shared across all tests in the worker)
- Plan: Test scope (created fresh for each test)

```typescript
import { sharedProviderFixtures as test } from '../../fixtures/resourceFixtures';

test('my test', async ({ page, testProvider, testPlan }) => {
  // testProvider is shared across tests
  // testPlan is unique to this test
});
```

### 2. `sharedProviderCustomPlanFixtures`

**Use case:** Multiple tests that need the same provider but want to create custom plans.

**Scope:**
- Provider: Worker scope (shared across all tests in the worker)
- Plan: None (use `createCustomPlan` instead)

```typescript
import { sharedProviderCustomPlanFixtures as test } from '../../fixtures/resourceFixtures';

test('my test', async ({ page, testProvider, createCustomPlan }) => {
  // Create a plan with custom settings
  const customPlan = await createCustomPlan({
    additionalPlanSettings: {
      targetPowerState: 'on',
      useNbdeClevis: true,
    },
  });
});
```

### 3. `isolatedFixtures`

**Use case:** Tests that need complete isolation with their own provider and plan.

**Scope:**
- Provider: Test scope (unique to each test)
- Plan: Test scope (unique to each test)

```typescript
import { isolatedFixtures as test } from '../../fixtures/resourceFixtures';

test('my test', async ({ page, testProvider, testPlan }) => {
  // Both testProvider and testPlan are unique to this test
});
```

### 4. `isolatedCustomPlanFixtures`

**Use case:** Tests that need their own provider and want to create custom plans or providers.

**Scope:**
- Provider: Test scope (unique to each test)
- Plan: None (use `createCustomPlan` instead)

```typescript
import { isolatedCustomPlanFixtures as test } from '../../fixtures/resourceFixtures';

test('my test', async ({ page, testProvider, createCustomPlan, createProviderFromKey }) => {
  // Create multiple custom plans with different settings
  const plan1 = await createCustomPlan({
    virtualMachines: [{ sourceName: 'vm-1' }],
  });
  
  // Or create a custom provider
  const ovaProvider = await createProviderFromKey('ova-nfs', 'my-ova-provider');
});
```

### 5. `providerOnlyFixtures`

**Use case:** Tests that only need a provider (no plans).

**Scope:**
- Provider: Test scope (unique to each test)
- Plan: None

```typescript
import { providerOnlyFixtures as test } from '../../fixtures/resourceFixtures';

test('my test', async ({ page, testProvider, resourceManager }) => {
  // Only testProvider is available
  // Good for testing provider-specific features
});
```

## Custom Fixture Functions

### `createCustomPlan`

Creates a plan with custom configuration while using the default provider.

**Parameters:**
- `customPlanData`: Partial plan configuration to override defaults

**Example:**
```typescript
const customPlan = await createCustomPlan({
  planName: 'my-custom-plan',
  virtualMachines: [
    { sourceName: 'vm-1', targetName: 'renamed-vm-1' },
    { sourceName: 'vm-2' }
  ],
  storageMap: {
    name: 'custom-storage-map',
    isPreexisting: false,
    mappings: [
      { source: 'source-ds', target: 'target-sc' }
    ]
  },
  additionalPlanSettings: {
    targetPowerState: 'on',
    useNbdeClevis: true,
  }
});
```

### `createProviderFromKey`

Creates a provider using a configuration key from `.providers.json`.

**Parameters:**
- `providerKey`: Key to look up in `.providers.json` (e.g., 'ova-nfs', 'vsphere-8.0.1')
- `namePrefix` (optional): Custom prefix for the provider name

**Example:**
```typescript
const ovaProvider = await createProviderFromKey('ova-nfs', 'my-ova-provider');
// Creates provider with name like: my-ova-provider-{uuid}
```

## Common Use Cases

### Creating an OVA Provider

```typescript
import { isolatedCustomPlanFixtures as test } from '../../fixtures/resourceFixtures';

test('OVA provider test', async ({ page, createProviderFromKey }) => {
  const ovaProvider = await createProviderFromKey('ova-nfs', 'test-ova');
  
  // Test OVA-specific functionality
  // Provider configuration comes from .providers.json
});
```

### Creating a vSphere Provider

```typescript
const vsphereProvider = await createProviderFromKey(
  'vsphere-8.0.1', 
  'test-vsphere'
);
// Configuration (hostname, credentials, VDDK, etc.) from .providers.json
```

### Creating Multiple Custom Plans

```typescript
import { sharedProviderCustomPlanFixtures as test } from '../../fixtures/resourceFixtures';

test('test multiple plans', async ({ page, testProvider, createCustomPlan }) => {
  // Create first plan with power state ON
  const plan1 = await createCustomPlan({
    additionalPlanSettings: {
      targetPowerState: 'on',
    },
  });
  
  // Create second plan with power state OFF
  const plan2 = await createCustomPlan({
    additionalPlanSettings: {
      targetPowerState: 'off',
    },
  });
  
  // Both plans use the same testProvider (shared)
});
```

### Testing Provider Details Without Plans

```typescript
import { providerOnlyFixtures as test } from '../../fixtures/resourceFixtures';

test('verify provider details', async ({ page, testProvider }) => {
  const providerDetailsPage = new ProviderDetailsPage(page);
  await providerDetailsPage.navigate(
    testProvider.metadata.name,
    testProvider.metadata.namespace
  );
  
  // Test provider-specific features
  // No plans are created for this test
});
```

### Using Different Provider Types

```typescript
test('test with multiple provider types', async ({ page, createProviderFromKey }) => {
  // Create vSphere provider
  const vsphere = await createProviderFromKey('vsphere-8.0.1', 'test-vsphere');
  
  // Create OVA provider
  const ova = await createProviderFromKey('ova-nfs', 'test-ova');
  
  // Both providers available in the same test
});
```

## Provider Configuration

Provider configurations are stored in `.providers.json` in the testing directory:

```json
{
  "vsphere-8.0.1": {
    "type": "vsphere",
    "endpoint_type": "vcenter",
    "api_url": "vcenter.example.com",
    "username": "administrator@vsphere.local",
    "password": "password",
    "vddk_init_image": "quay.io/example/vddk:latest"
  },
  "ova-nfs": {
    "type": "ova",
    "api_url": "nfs://nfs-server.example.com/path",
    "username": "user",
    "password": "password"
  }
}
```

You can reference these configurations by key in your tests using environment variables:

```bash
VSPHERE_PROVIDER=vsphere-8.0.1 yarn test:downstream
OVA_PROVIDER=ova-nfs yarn test:downstream
```

## Resource Cleanup

All fixtures automatically handle resource cleanup:

- **Test-scoped resources**: Cleaned up after each test
- **Worker-scoped resources**: Cleaned up after all tests in the worker complete
- Resources are tracked by the `resourceManager` fixture
- Cleanup happens in reverse order of creation

## Best Practices

1. **Choose the right fixture**
   - Use shared provider fixtures when tests don't interfere with each other
   - Use isolated fixtures when tests modify provider state
   - Use custom fixtures when you need specific configurations

2. **Resource efficiency**
   - Prefer shared providers over isolated when possible
   - Worker-scoped providers reduce test runtime
   - Only create resources you actually need

3. **Test isolation**
   - Use isolated fixtures for tests that modify resources
   - Use custom fixtures to avoid test dependencies
   - Each test should be independently runnable

4. **Provider configuration**
   - Store provider configs in `.providers.json`
   - Use provider keys instead of hardcoding credentials
   - Use environment variables to select configurations

5. **Error handling**
   - All fixtures throw descriptive errors on failure
   - Resource cleanup runs even if tests fail
   - Check fixture requirements before use

## Examples

See complete examples in:
- `testing/playwright/e2e/downstream/ova-upload.spec.ts` - OVA provider tests
- `testing/playwright/e2e/downstream/custom-fixtures-example.spec.ts` - Comprehensive examples
- `testing/playwright/e2e/downstream/plan-details-page.spec.ts` - Shared provider fixtures
- `testing/playwright/e2e/downstream/plan-additional-settings.spec.ts` - Provider-only fixtures

## Troubleshooting

### Provider creation fails

```
Error: Provider configuration not found for key: ova-nfs
```

**Solution:** Add the provider configuration to `.providers.json` in the testing directory.

### Test provider not available

```
Error: createCustomPlan requires testProvider fixture to be enabled
```

**Solution:** Use a fixture that provides `testProvider` (not `providerOnlyFixtures`).

### Resource conflicts

If you see conflicts between tests, try:
1. Switch to isolated fixtures
2. Use unique name prefixes in `createProviderFromKey`
3. Verify cleanup is working correctly

## Advanced Configuration

You can create your own custom fixture configurations:

```typescript
import { createResourceFixtures } from '../../fixtures/resourceFixtures';

export const myCustomFixtures = createResourceFixtures({
  providerScope: 'worker',
  planScope: 'none',
  providerPrefix: 'my-custom-provider',
});
```

Parameters:
- `providerScope`: 'test' | 'worker'
- `planScope`: 'test' | 'none'
- `providerPrefix`: Custom prefix for provider names
