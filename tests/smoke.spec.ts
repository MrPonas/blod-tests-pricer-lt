import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Laboratorij/i);
  await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
});
