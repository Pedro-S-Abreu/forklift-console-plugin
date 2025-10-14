import type { Page } from '@playwright/test';

export const disableGuidedTour = async (page: Page) => {
  await page.addInitScript(() => {
    const existingSettings = window.localStorage.getItem('console-user-settings');
    const settings = existingSettings ? JSON.parse(existingSettings) : {};

    window.localStorage.setItem(
      'console-user-settings',
      JSON.stringify({ ...settings, 'console.guidedTour': { admin: { completed: true } } }),
    );
  });
};

/**
 * Dismiss the OpenShift guided tour modal if it appears
 * Should be called before interacting with page elements that might be blocked
 */
export const dismissGuidedTourModal = async (page: Page): Promise<void> => {
  const tourDialog = page.getByRole('dialog');

  // Wait up to 3s for modal to appear (it may render after page load)
  if (await tourDialog.isVisible({ timeout: 3000 })) {
    const skipButton = tourDialog.getByRole('button', { name: 'Skip tour' });
    await skipButton.click();
    // Wait for modal to fully dismiss
    await tourDialog.waitFor({ state: 'hidden' });
  }
};

export const isEmpty = (value: object | unknown[] | string | undefined | null): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value) || typeof value === 'string') {
    // eslint-disable-next-line no-restricted-syntax
    return value.length === 0;
  }

  if (typeof value === 'object') {
    // eslint-disable-next-line no-restricted-syntax
    return Object.keys(value).length === 0;
  }

  return false;
};

/**
 * Wait for PatternFly CSS to be loaded by checking for the presence of PF classes
 * This helps ensure tests don't run before styles are applied
 */
export const waitForPatternFlyStyles = async (page: Page, timeout = 15000): Promise<void> => {
  try {
    await page.waitForFunction(
      () => {
        // Check if PatternFly CSS is loaded by looking for a specific CSS rule or applied styles
        const sheets = Array.from(document.styleSheets);
        const hasPFStylesheets = sheets.some((sheet) => {
          try {
            // Check for PatternFly v6 CSS variables or classes
            const rules = Array.from(sheet.cssRules || []);
            return rules.some(
              (rule) =>
                rule.cssText.includes('pf-v6-') ||
                rule.cssText.includes('--pf-t-') ||
                rule.cssText.includes('--pf-v6-') ||
                rule.cssText.includes('pf-v5-'), // Also accept v5 CSS as fallback
            );
          } catch {
            // CORS or other errors accessing stylesheet
            return false;
          }
        });

        // Also check if PatternFly classes are applied to elements in the DOM
        const hasPFElements = document.querySelector('[class*="pf-v6-"], [class*="pf-v5-"]');

        return hasPFStylesheets || hasPFElements !== null;
      },
      { timeout },
    );
  } catch (error) {
    // If CSS check fails, log warning but continue (console might provide CSS)
    console.warn('⚠️ PatternFly CSS check timed out, continuing anyway...');
  }
};
