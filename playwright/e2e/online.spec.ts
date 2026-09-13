import { test, expect } from '@playwright/test'

test('webapp deve estar online', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Velô by Papito/)
})
