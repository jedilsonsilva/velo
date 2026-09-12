import { Page, expect } from '@playwright/test'

const CONFIGURATOR_STORAGE_KEY = 'velo-configurator-storage'

export function createHeroActions(page: Page) {
  return {
    async open() {
      await page.goto('/')
      await expect(page.getByTestId('landing-page')).toBeVisible()
      await page.evaluate((key: string) => localStorage.removeItem(key), CONFIGURATOR_STORAGE_KEY)
      await page.getByTestId('hero-cta-primary').click()
      await expect(page).toHaveURL(/\/configure/)
      await expect(page.getByRole('heading', { name: 'Velô Sprint', level: 1 })).toBeVisible()
    },
  }
}
