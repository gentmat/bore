import { test, expect } from '@playwright/test';

test.describe('Create Instance Flow', () => {
  test.beforeEach(async ({ page }) => {
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
                return [];
              case 'start_status_listener':
                return undefined;
              case 'stop_status_listener':
                return undefined;
              case 'find_available_port_command':
                return 8081;
              case 'start_code_server_instance':
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
          open: async () => '/home/user/test-project',
        },
      };
    });
    
    await page.goto('/');
    await page.waitForSelector('text=No tunnel instances yet', { timeout: 10000 });
  });

  test('should display create instance modal', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
    await expect(page.locator('label:has-text("Instance Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Project Folder")')).toBeVisible();
  });

  test('should have pre-filled instance name', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    const nameInput = page.locator('input[placeholder="my-code-server"]');
    await expect(nameInput).toHaveValue(/code-server-\d+/);
  });

  test('should allow changing instance name', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    const nameInput = page.locator('input[placeholder="my-code-server"]');
    await nameInput.fill('my-custom-instance');
    
    await expect(nameInput).toHaveValue('my-custom-instance');
  });

  test('should open folder picker when browse is clicked', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    await page.click('button:has-text("Browse")');
    
    // Check if path was filled (mocked to return /home/user/test-project)
    const pathInput = page.locator('input[placeholder="Select a folder for your project"]');
    await expect(pathInput).toHaveValue('/home/user/test-project');
  });

  test('should allow manual path entry', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    const pathInput = page.locator('input[placeholder="Select a folder for your project"]');
    await pathInput.fill('/home/user/manual-path');
    
    await expect(pathInput).toHaveValue('/home/user/manual-path');
  });

  test('should show error when creating without path', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    const createButton = page.locator('button:has-text("Create Instance")');
    await createButton.click();
    
    await expect(page.locator('text=Please select a project folder')).toBeVisible();
  });

  test('should show helpful information', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    await expect(page.locator('text=Auto-start')).toBeVisible();
    await expect(page.locator('text=Port will be automatically selected')).toBeVisible();
  });

  test('should close modal when cancel is clicked', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
    
    await page.click('button:has-text("Cancel")');
    
    await expect(page.locator('text=Create New Tunnel Instance')).not.toBeVisible();
  });

  test('should close modal when X is clicked', async ({ page }) => {
    await page.click('button:has-text("Create First Instance")');
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
    
    // Click the X button (close button)
    await page.click('button[class*="text-gray-400"]');
    
    await expect(page.locator('text=Create New Tunnel Instance')).not.toBeVisible();
  });

  test('should create instance successfully', async ({ page }) => {
    // Update mock to return an instance after creation
    await page.addInitScript(() => {
      let instanceCreated = false;
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
                if (instanceCreated) {
                  return [
                    {
                      id: '1',
                      name: 'my-custom-instance',
                      local_port: 8081,
                      region: 'us-east',
                      server_address: 'bore.pub',
                      public_url: null,
                      remote_port: null,
                      status: 'inactive',
                    },
                  ];
                }
                return [];
              case 'start_status_listener':
                return undefined;
              case 'stop_status_listener':
                return undefined;
              case 'find_available_port_command':
                return 8081;
              case 'start_code_server_instance':
                instanceCreated = true;
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
          open: async () => '/home/user/test-project',
        },
      };
    });
    
    await page.goto('/');
    await page.waitForSelector('text=No tunnel instances yet', { timeout: 10000 });
    
    await page.click('button:has-text("Create First Instance")');
    
    const nameInput = page.locator('input[placeholder="my-code-server"]');
    await nameInput.fill('my-custom-instance');
    
    const pathInput = page.locator('input[placeholder="Select a folder for your project"]');
    await pathInput.fill('/home/user/test-project');
    
    await page.click('button:has-text("Create Instance")');
    
    // Modal should close
    await expect(page.locator('text=Create New Tunnel Instance')).not.toBeVisible({ timeout: 5000 });
    
    // Instance should appear in the list
    await expect(page.locator('text=my-custom-instance')).toBeVisible({ timeout: 5000 });
  });

  test('should show loading state during creation', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI__ = {
        tauri: {
          invoke: async (command: string) => {
            if (command === 'start_code_server_instance') {
              await new Promise(resolve => setTimeout(resolve, 1000));
              return undefined;
            }
            return {
              bore_installed: true,
              bore_installed_now: false,
              code_server_installed: true,
              code_server_installed_now: false,
            };
          },
        },
        event: { listen: async () => () => {} },
        dialog: { open: async () => '/home/user/test-project' },
      };
    });
    
    await page.goto('/');
    await page.waitForSelector('text=No tunnel instances yet', { timeout: 10000 });
    
    await page.click('button:has-text("Create First Instance")');
    
    const pathInput = page.locator('input[placeholder="Select a folder for your project"]');
    await pathInput.fill('/home/user/test-project');
    
    await page.click('button:has-text("Create Instance")');
    
    // Should show loading state
    await expect(page.locator('text=Creating...')).toBeVisible();
  });
});

test.describe('Create Instance from Header', () => {
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
                return [
                  {
                    id: '1',
                    name: 'existing-tunnel',
                    local_port: 8080,
                    region: 'us-east',
                    server_address: 'bore.pub',
                    public_url: null,
                    remote_port: null,
                    status: 'inactive',
                  },
                ];
              case 'start_status_listener':
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
          open: async () => '/home/user/test-project',
        },
      };
    });
    
    await page.goto('/');
    await page.waitForSelector('text=existing-tunnel', { timeout: 10000 });
  });

  test('should open modal from header New Instance button', async ({ page }) => {
    await page.click('button:has-text("New Instance")');
    
    await expect(page.locator('text=Create New Tunnel Instance')).toBeVisible();
  });
});
