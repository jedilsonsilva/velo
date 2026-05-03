import { test as base } from '@playwright/test'

import { createConfiguratorActions } from './actions/configuratorActions'
import { createOrderLookupActions } from './actions/orderLookupActions'

type App = {
  orderLookup: ReturnType<typeof createOrderLookupActions>
  configurator: ReturnType<typeof createConfiguratorActions>
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    const app: App = {
      orderLookup: createOrderLookupActions(page),
      configurator: createConfiguratorActions(page),
    }
    await use(app)
  },
})

export { expect } from '@playwright/test'