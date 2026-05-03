import { Page, expect } from '@playwright/test'

export type ExteriorColorLabel = 'Glacier Blue' | 'Midnight Black' | 'Lunar White'

export type WheelTypeOption = 'aero' | 'sport'

export type OptionalExtraLabel = 'Precision Park' | 'Flux Capacitor'

const CONFIGURATOR_STORAGE_KEY = 'velo-configurator-storage'

export function createConfiguratorActions(page: Page) {
  return {
    async open() {
      await page.goto('/configure')
      await expect(page.getByRole('heading', { name: 'Velô Sprint', level: 1 })).toBeVisible()
    },

    /**
     * Garante pré-condição do CT03 (valor inicial R$ 40.000) mesmo com estado persistido
     * em `localStorage` de execuções anteriores no mesmo origin.
     */
    async openClearingPersistedConfigurator() {
      await page.goto('/')
      await page.evaluate((key: string) => localStorage.removeItem(key), CONFIGURATOR_STORAGE_KEY)
      await page.goto('/configure')
      await expect(page.getByRole('heading', { name: 'Velô Sprint', level: 1 })).toBeVisible()
    },

    async selectExteriorColor(label: ExteriorColorLabel) {
      await page.getByRole('button', { name: label }).click()
    },

    async selectWheels(type: WheelTypeOption) {
      const name = type === 'aero' ? /Aero Wheels/i : /Sport Wheels/i
      await page.getByRole('button', { name }).click()
    },

    async checkOptional(option: OptionalExtraLabel) {
      await page.getByRole('checkbox', { name: new RegExp(option, 'i') }).click()
    },

    async expectExteriorPreviewAlt(pattern: RegExp) {
      const exteriorPreview = page.getByTestId('car-exterior-image')
      await expect(exteriorPreview).toHaveAttribute('alt', pattern)
    },

    async expectPrice(price: string) {
      const totalPrice = page.getByTestId('total-price')
      await expect(totalPrice).toHaveText(price)
      await expect(totalPrice).toBeVisible()
    },
  }
}
