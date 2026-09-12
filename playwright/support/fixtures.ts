import { test as base } from '@playwright/test'

import { createCheckoutActions } from './actions/checkoutActions'
import { createConfiguratorActions } from './actions/configuratorActions'
import { createHeroActions } from './actions/heroActions'
import { createMockActions } from './actions/mockActions'
import { createOrderLookupActions } from './actions/orderLookupActions'
import { createCheckoutFeature } from './features/checkoutFeature'

type App = {
  checkout: ReturnType<typeof createCheckoutActions>
  checkoutFeature: ReturnType<typeof createCheckoutFeature>
  configurator: ReturnType<typeof createConfiguratorActions>
  hero: ReturnType<typeof createHeroActions>
  mock: ReturnType<typeof createMockActions>
  orderLookup: ReturnType<typeof createOrderLookupActions>
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    const checkout = createCheckoutActions(page)
    const configurator = createConfiguratorActions(page)
    const mock = createMockActions(page)

    const app: App = {
      checkout,
      checkoutFeature: createCheckoutFeature({ checkout, configurator, mock }),
      configurator,
      hero: createHeroActions(page),
      mock,
      orderLookup: createOrderLookupActions(page),
    }
    await use(app)
  },
})

export { expect } from '@playwright/test'
