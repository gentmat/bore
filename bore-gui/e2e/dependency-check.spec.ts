import { test, expect } from '@playwright/test';

test.describe('Dependency Check', () => {
  test('should show dependency error when bore-client is missing', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            if (command === 'ensure_dependencies') {
              return {
                bore_installed: false,
                bore_error: 'bore-client not found',
                bore_installed_now: false,
                code_server_installed: true,
                code_server_installed_now: false,
              };
            }
            return undefined;
          },
        },
        event: { listen: async () => () => {} },
        dialog: { open: async () => '/mock/path' },
      };
    });
    
    await page.goto('/');
    
    await expect(page.locator('text=Dependency setup failed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=bore-client not found')).toBeVisible();
  });

  test('should show dependency error when code-server is missing', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            if (command === 'ensure_dependencies') {
              return {
                bore_installed: true,
                bore_installed_now: false,
                code_server_installed: false,
                code_server_error: 'code-server not found',
                code_server_installed_now: false,
              };
            }
            return undefined;
          },
        },
        event: { listen: async () => () => {} },
        dialog: { open: async () => '/mock/path' },
      };
    });
    
    await page.goto('/');
    
    await expect(page.locator('text=Dependency setup failed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=code-server not found')).toBeVisible();
  });

  test('should show manual installation instructions', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            if (command === 'ensure_dependencies') {
              return {
                bore_installed: false,
                bore_installed_now: false,
                code_server_installed: false,
                code_server_installed_now: false,
              };
            }
            return undefined;
          },
        },
        event: { listen: async () => () => {} },
        dialog: { open: async () => '/mock/path' },
      };
    });
    
    await page.goto('/');
    
    await expect(page.locator('text=Manual Installation Steps:')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Try Again')).toBeVisible();
  });

  test('should retry dependency check', async ({ page }) => {
    let attemptCount = 0;
    
    await page.addInitScript(() => {
      let localAttemptCount = 0;
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            if (command === 'ensure_dependencies') {
              localAttemptCount++;
              if (localAttemptCount === 1) {
                return {
                  bore_installed: false,
                  bore_installed_now: false,
                  code_server_installed: false,
                  code_server_installed_now: false,
                };
              } else {
                return {
                  bore_installed: true,
                  bore_installed_now: false,
                  code_server_installed: true,
                  code_server_installed_now: false,
                };
              }
            }
            if (command === 'check_auth') {
              return null;
            }
            return undefined;
          },
        },
        event: { listen: async () => () => {} },
        dialog: { open: async () => '/mock/path' },
      };
    });
    
    await page.goto('/');
    
    await expect(page.locator('text=Dependency setup failed')).toBeVisible({ timeout: 10000 });
    
    const tryAgainButton = page.locator('button:has-text("Try Again")');
    await tryAgainButton.click();
    
    // Should now show login page
    await expect(page.locator('text=Sign in to your account')).toBeVisible({ timeout: 10000 });
  });

  test('should show loading message during dependency check', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            if (command === 'ensure_dependencies') {
              // Delay response to see loading state
              await new Promise(resolve => setTimeout(resolve, 1000));
              return {
                bore_installed: true,
                bore_installed_now: false,
                code_server_installed: true,
                code_server_installed_now: false,
              };
            }
            if (command === 'check_auth') {
              return null;
            }
            return undefined;
          },
        },
        event: { listen: async () => () => {} },
        dialog: { open: async () => '/mock/path' },
      };
    });
    
    await page.goto('/');
    
    // Should show loading state
    const loadingIndicator = page.locator('text=Preparing environment');
    await expect(loadingIndicator).toBeVisible();
  });
});
