import { Page } from '@playwright/test';

/**
 * Helper functions for e2e tests
 */

export async function mockTauriAPI(page: Page) {
  // Mock Tauri API for e2e tests
  await page.addInitScript(() => {
    // Mock invoke function
    (window as any).__TAURI__ = {
      tauri: {
        invoke: async (command: string, args?: any) => {
          console.log('Mock invoke:', command, args);
          
          // Mock responses for different commands
          switch (command) {
            case 'ensure_dependencies':
              return {
                bore_installed: true,
                bore_installed_now: false,
                code_server_installed: true,
                code_server_installed_now: false,
              };
            
            case 'check_auth':
              return null; // Not authenticated by default
            
            case 'list_instances':
              return [];
            
            case 'start_status_listener':
              return undefined;
            
            case 'stop_status_listener':
              return undefined;
            
            case 'login':
              if (args.email === 'test@example.com' && args.password === 'password123') {
                return {
                  success: true,
                  user_id: 'test-user-id',
                  token: 'test-token',
                  message: 'Login successful',
                };
              }
              return {
                success: false,
                message: 'Invalid credentials',
              };
            
            case 'signup':
              return {
                success: true,
                user_id: 'new-user-id',
                token: 'new-token',
                message: 'Signup successful',
              };
            
            case 'logout':
              return undefined;
            
            default:
              console.warn('Unhandled command:', command);
              return undefined;
          }
        },
      },
      event: {
        listen: async (event: string, callback: Function) => {
          console.log('Mock listen:', event);
          return () => {}; // Return unlisten function
        },
      },
      dialog: {
        open: async (options: any) => {
          console.log('Mock dialog open:', options);
          return '/mock/project/path';
        },
      },
    };
  });
}

export async function waitForLoadingToComplete(page: Page) {
  // Wait for any loading indicators to disappear
  await page.waitForSelector('text=Preparing environment', { state: 'hidden', timeout: 10000 });
}

export async function login(page: Page, email: string = 'test@example.com', password: string = 'password123') {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}
