# oVirt Provider Test Guide

## Overview
This guide explains how to create and test oVirt (Red Hat Virtualization) providers using the automated Playwright tests.

## Prerequisites

### 1. Provider Configuration
The oVirt provider configuration must be present in `/testing/.providers.json`:

```json
{
  "ovirt-4.4.9": {
    "type": "ovirt",
    "version": "4.4.9",
    "fqdn": "rhev-red-02.rdu2.scalelab.redhat.com",
    "api_url": "https://rhev-red-02.rdu2.scalelab.redhat.com/ovirt-engine/api",
    "username": "admin@internal",
    "password": "qum5net"
  }
}
```

### 2. Required Fields for oVirt Provider Creation

Based on the UI exploration using Playwright MCP on localhost:9000, the following fields are required:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Project** | ✓ | Target namespace for the provider | `openshift-mtv` |
| **Provider Type** | ✓ | Must be "Red Hat Virtualization" | `ovirt` |
| **Provider Resource Name** | ✓ | Unique name for the provider | `test-ovirt-provider-abc123` |
| **URL** | ✓ | RHVM API endpoint URL | `https://rhev-red-02.rdu2.scalelab.redhat.com/ovirt-engine/api` |
| **Username** | ✓ | RHVM authentication username | `admin@internal` |
| **Password** | ✓ | RHVM authentication password | `qum5net` |
| **Skip Certificate Validation** | | Optional switch for cert validation | `true` (default in tests) |
| **CA Certificate** | | Optional CA certificate upload | - |

## Test Implementation

### Test File Location
```
testing/playwright/e2e/downstream/create-provider.spec.ts
```

### Helper Function: `createOvirtProviderData()`

```typescript
const createOvirtProviderData = (overrides: Partial<ProviderData> = {}): ProviderData => {
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
```

### Test Scenarios

The test suite includes the following oVirt test scenario:

```typescript
const ovirtProviderTestScenarios: OvirtProviderTestScenario[] = [
  {
    scenarioName: 'oVirt 4.4.9 provider',
    useCustomData: false,
  },
];
```

### Test Flow

1. **Navigate to Providers Page**
   - Uses `ProvidersListPage.navigateFromMainMenu()`
   
2. **Click Create Provider Button**
   - Uses `ProvidersListPage.clickCreateProviderButton()`
   
3. **Wait for Form Load**
   - Uses `CreateProviderPage.waitForWizardLoad()`
   
4. **Fill and Submit Provider Form**
   - Selects project: `openshift-mtv`
   - Selects provider type: Red Hat Virtualization (ovirt)
   - Fills provider name: Generated unique name
   - Fills URL: From `.providers.json`
   - Fills username: From `.providers.json`
   - Fills password: From `.providers.json`
   - Enables "Skip certificate validation"
   
5. **Verify Provider Creation**
   - Waits for provider details page to load
   - Verifies provider details match input data
   - Fetches provider resource from cluster
   - Validates provider type is 'ovirt'

## Running the Tests

### Environment Variables

You can specify a different oVirt provider configuration using:

```bash
export OVIRT_PROVIDER=ovirt-4.4.9
```

### Run the Test Suite

```bash
# Run all provider creation tests (including oVirt)
cd testing
npm test create-provider.spec.ts

# Run only downstream tests
npm test -- --grep @downstream

# Run with specific provider configuration
OVIRT_PROVIDER=ovirt-4.4.9 npm test create-provider.spec.ts
```

### Run with Docker

```bash
cd testing
./run-e2e-docker.sh create-provider.spec.ts
```

## UI Elements Used (Test IDs)

The test relies on the following data-testid attributes:

- `target-project-select` - Project selection dropdown
- `ovirt-provider-card` - oVirt provider type card
- `provider-name-input` - Provider name input field
- `provider-url-input` - URL input field
- `provider-username-input` - Username input field
- `provider-password-input` - Password input field
- `skip-certificate-validation-switch` - Certificate validation toggle
- `create-provider-button` - Submit button

## Cleanup

The test automatically cleans up created providers using:

```typescript
test.afterAll(async () => {
  await resourceManager.instantCleanup();
});
```

This ensures that all providers created during the test run are deleted from the cluster.

## Adding More oVirt Test Scenarios

To add additional test scenarios, extend the `ovirtProviderTestScenarios` array:

```typescript
const ovirtProviderTestScenarios: OvirtProviderTestScenario[] = [
  {
    scenarioName: 'oVirt 4.4.9 provider',
    useCustomData: false,
  },
  {
    scenarioName: 'oVirt with custom configuration',
    useCustomData: true,
  },
];
```

Then update the test to handle custom data:

```typescript
const testProviderData = scenario.useCustomData 
  ? createOvirtProviderData({ /* custom overrides */ })
  : createOvirtProviderData();
```

## Troubleshooting

### Common Issues

1. **Provider not found in .providers.json**
   - Ensure the provider key exists in the configuration file
   - Check the `OVIRT_PROVIDER` environment variable

2. **Connection timeout**
   - Verify the oVirt RHVM is accessible from the test environment
   - Check network connectivity to the API endpoint

3. **Authentication failures**
   - Verify username format (e.g., `admin@internal`)
   - Ensure password is correct in `.providers.json`

4. **Certificate validation errors**
   - The test enables "Skip certificate validation" by default
   - If needed, provide a CA certificate

## Related Files

- Test file: `testing/playwright/e2e/downstream/create-provider.spec.ts`
- Provider config: `testing/.providers.json`
- Page object: `testing/playwright/page-objects/CreateProviderPage.ts`
- Provider utilities: `testing/playwright/utils/providers.ts`
- Resource manager: `testing/playwright/utils/resource-manager/ResourceManager.ts`

