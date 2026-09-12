import { Page } from '@playwright/test'

export function createMockActions(page: Page) {
  return {
    async creditAnalysis(score: number) {
      await page.route('**/functions/v1/credit-analysis', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'Done', score }),
        })
      })
    },
  }
}
