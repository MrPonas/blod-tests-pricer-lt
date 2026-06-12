import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Laboratorij/i);
  await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
});

test('search results show prices', async ({ page }) => {
  await page.goto('/search?q=vitaminas');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/search-vitaminas.png', fullPage: true });
});

test('search results for TSH', async ({ page }) => {
  await page.goto('/search?q=TSH');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/search-tsh.png', fullPage: true });
});
