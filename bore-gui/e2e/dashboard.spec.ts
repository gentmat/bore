import { test, expect } from '@playwright/test';
import { mockTauriAPI, waitForLoadingToComplete, login } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string, args?: any) => {
            switch (command) {
              case 'ensure_dependencies':
                return {
                  bore_installed: true,
                  bore_installed_now: false,
                  code_server_installed: true,
                  code_server_installed_now: false,
                };
              case 'check_auth':
                return {
                  user_id: 'test-user-id',
                  token: 'test-token',
                  email: 'test@example.com',
                };
              case 'list_instances':
                return [
                  {
                    id: '1',
                    name: 'test-tunnel',
                    local_port: 8080,
                    region: 'us-east',
                    server_address: 'bore.pub',
                    public_url: 'http://test.bore.pub',
                    remote_port: 12345,
                    status: 'active',
                  },
                ];
              case 'start_status_listener':
                return undefined;
              case 'stop_status_listener':
                return undefined;
              case 'logout':
                return undefined;
              default:
                return undefined;
            }
          },
        },
        event: {
          listen: async () => () => {},
        },
        dialog: {
          open: async () => '/mock/project/path',
        },
      };
    });
    
    await page.goto('/');
    await waitForLoadingToComplete(page);
  });

  test('should display dashboard with user email', async ({ page }) => {
    await expect(page.locator('text=Bore Tunnel')).toBeVisible();
    await expect(page.locator('text=test@example.com')).toBeVisible();
  });

  test('should display active tunnel count', async ({ page }) => {
    await expect(page.locator('text=1 active tunnel')).toBeVisible();
  });

  test('should display tunnel instances', async ({ page }) => {
    await expect(page.locator('text=test-tunnel')).toBeVisible();
  });

  test('should have New Instance button', async ({ page }) => {
    const newInstanceButton = page.locator('button:has-text("New Instance")');
    await expect(newInstanceButton).toBeVisible();
  });

  test('should have Refresh button', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();
  });

  test('should have Logout button', async ({ page }) => {
    const logoutButton = page.locator('button:has-text("Logout")');
    await expect(logoutButton).toBeVisible();
  });

  test('should open create instance modal', async ({ page }) => {
    const newInstanceButton = page.locator('button:has-text("New Instance")');
    await newInstanceButton.click();
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
    await expect(page.locator('text=Instance Name')).toBeVisible();
    await expect(page.locator('text=Project Folder')).toBeVisible();
  });

  test('should close create instance modal', async ({ page }) => {
    const newInstanceButton = page.locator('button:has-text("New Instance")');
    await newInstanceButton.click();
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
    
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();
    
    await expect(page.locator('text=Create New Tunnel Instance')).not.toBeVisible();
  });

  test('should logout and return to login page', async ({ page }) => {
    const logoutButton = page.locator('button:has-text("Logout")');
    await logoutButton.click();
    
    // Should return to login page
    await expect(page.locator('text=Sign in to your account')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            switch (command) {
              case 'ensure_dependencies':
                return {
                  bore_installed: true,
                  bore_installed_now: false,
                  code_server_installed: true,
                  code_server_installed_now: false,
                };
              case 'check_auth':
                return {
                  user_id: 'test-user-id',
                  token: 'test-token',
                  email: 'test@example.com',
                };
              case 'list_instances':
                return []; // Empty instances
              case 'start_status_listener':
                return undefined;
              case 'stop_status_listener':
                return undefined;
              default:
                return undefined;
            }
          },
        },
        event: {
          listen: async () => () => {},
        },
        dialog: {
          open: async () => '/mock/project/path',
        },
      };
    });
    
    await page.goto('/');
    await waitForLoadingToComplete(page);
  });

  test('should show empty state message', async ({ page }) => {
    await expect(page.locator('text=No tunnel instances yet')).toBeVisible();
    await expect(page.locator('text=Create your first tunnel instance')).toBeVisible();
  });

  test('should have create button in empty state', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create First Instance")');
    await expect(createButton).toBeVisible();
  });

  test('should open modal from empty state', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create First Instance")');
    await createButton.click();
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
  });
});
