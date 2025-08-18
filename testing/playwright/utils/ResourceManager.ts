import { existsSync, readFileSync, writeFileSync } from 'fs';

import type { Page } from '@playwright/test';

import { isEmpty } from '../../../src/utils/helpers';

const RESOURCES_FILE = 'playwright/.resources.json';

export interface ResourceToCleanup {
  namespace: string;
  resourceType: string;
  resourceName: string;
  apiVersion?: string;
}

export class ResourceManager {
  private resources: ResourceToCleanup[] = [];

  private async cleanupResource(page: Page, resource: ResourceToCleanup) {
    const { apiVersion, namespace, resourceType, resourceName } = resource;

    // Namespaced resources URL
    const url = namespace
      ? `/api/kubernetes/apis/${apiVersion}/namespaces/${namespace}/${resourceType}/${resourceName}`
      : `/api/kubernetes/apis/${apiVersion}/${resourceType}/${resourceName}`;

    // Use the browser's context to include authentication headers and cookies
    const response = await page.evaluate(async (deleteUrl) => {
      // Get the CSRF token from the meta tag or cookie
      const csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ??
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('csrf-token='))
          ?.split('=')[1];

      const fetchResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken ?? '',
        },
        credentials: 'include',
      });
      return {
        ok: fetchResponse.ok,
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
      };
    }, url);

    if (response.ok) {
      return true;
    }
    // ignore 404 errors on cleanup
    if (response.status === 404) {
      console.log(`Resource ${resource.resourceName} not found, skipping cleanup.`);
      return true;
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  addResource(resource: ResourceToCleanup) {
    const getDefaultApiVersion = (resourceType: string) => {
      switch (resourceType) {
        case 'projects':
          return 'project.openshift.io/v1';
        default:
          return 'forklift.konveyor.io/v1beta1';
      }
    };

    this.resources.push({
      ...resource,
      apiVersion: resource.apiVersion ?? getDefaultApiVersion(resource.resourceType),
    });
  }

  async cleanupAll(page: Page) {
    if (isEmpty(this.resources)) {
      console.log('No resources to cleanup');
      return;
    }

    console.log(`🧹 Starting cleanup of ${this.resources.length} resources...`);

    const cleanupPromises = this.resources.map(async (resource) =>
      this.cleanupResource(page, resource),
    );

    // Run cleanup in parallel but handle errors gracefully
    const results = await Promise.allSettled(cleanupPromises);

    let successCount = 0;
    let failureCount = 0;

    for (const [index, result] of results.entries()) {
      const resource = this.resources[index];
      if (result.status === 'fulfilled') {
        successCount += 1;

        console.log(`✅ Cleaned up ${resource.resourceType} ${resource.resourceName}`);
      } else {
        failureCount += 1;

        console.warn(
          `⚠️ Failed to cleanup ${resource.resourceType} ${resource.resourceName}:`,
          String(result.reason).split('\\n')[0],
        );
      }
    }

    console.log(`🧹 Cleanup completed: ${successCount} successful, ${failureCount} failed`);

    this.resources = [];
  }

  getResourceCount(): number {
    return this.resources.length;
  }

  getResources(): ResourceToCleanup[] {
    return [...this.resources];
  }

  loadResourcesFromFile() {
    if (existsSync(RESOURCES_FILE)) {
      const data = readFileSync(RESOURCES_FILE, 'utf-8');
      this.resources = JSON.parse(data);
    }
  }

  saveResourcesToFile() {
    writeFileSync(RESOURCES_FILE, JSON.stringify(this.resources, null, 2));
  }
}
