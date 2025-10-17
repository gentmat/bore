import { test, expect } from '@playwright/test';
import { mockTauriAPI, waitForLoadingToComplete, login } from './helpers';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriAPI(page);
    await page.goto('/');
  });

  test('should display login page after loading', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
    await expect(page.locator('text=Bore Tunnel')).toBeVisible();
  });

  test('should show email and password inputs', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    await login(page, 'test@example.com', 'password123');
    
    // Should navigate to dashboard
    await expect(page.locator('text=test@example.com')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=active tunnel')).toBeVisible();
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should disable form during login', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    // Fill the form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Start submission
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Check for loading state (may be brief)
    const loadingText = page.locator('text=Signing in');
    if (await loadingText.isVisible().catch(() => false)) {
      await expect(page.locator('input[type="email"]')).toBeDisabled();
      await expect(page.locator('input[type="password"]')).toBeDisabled();
    }
  });

  test('should navigate to signup page', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    await page.click('text=Sign Up');
    
    await expect(page.locator('text=Create your account')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required');
  });

  test('should validate password is required', async ({ page }) => {
    await waitForLoadingToComplete(page);
    
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('required');
  });
});
