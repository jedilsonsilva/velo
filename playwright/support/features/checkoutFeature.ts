import { deleteOrderByEmail } from '../database/orderRepository'
import type { createCheckoutActions } from '../actions/checkoutActions'
import type { createConfiguratorActions } from '../actions/configuratorActions'
import type { createMockActions } from '../actions/mockActions'

export type CheckoutOrder = {
  name: string
  lastname: string
  email: string
  phone: string
  document: string
  store: string
  paymentMethod: string
  totalPrice: string
  downPayment?: string
  creditScore?: number
  expectedResult: string
}

type CheckoutFeatureDeps = {
  checkout: ReturnType<typeof createCheckoutActions>
  configurator: ReturnType<typeof createConfiguratorActions>
  mock: ReturnType<typeof createMockActions>
}

export function createCheckoutFeature(deps: CheckoutFeatureDeps) {
  const { checkout, configurator, mock } = deps

  async function openCheckoutWithBaseCar(totalPrice: string) {
    await configurator.expectPrice(totalPrice)
    await configurator.finishConfigurator()
    await checkout.expectLoaded()
  }

  async function fillCustomer(
    order: Pick<CheckoutOrder, 'name' | 'lastname' | 'email' | 'phone' | 'document' | 'store'>,
  ) {
    await checkout.fillCustomerlData(order)
    await checkout.selectStore(order.store)
  }

  async function confirmPayment(
    order: Pick<CheckoutOrder, 'paymentMethod' | 'totalPrice' | 'downPayment'>,
  ) {
    await checkout.selectPaymentMethod(order.paymentMethod)

    if (order.downPayment !== undefined) {
      await checkout.fillDownPayment(order.downPayment)
    }

    if (order.paymentMethod === 'À Vista') {
      await checkout.expectSummaryTotal(order.totalPrice)
    }

    await checkout.acceptTerms()
    await checkout.submit()
  }

  async function completePurchase(
    order: CheckoutOrder,
    options?: {
      creditScore?: number
      expectedResult?: string
    },
  ) {
    const creditScore = options?.creditScore ?? order.creditScore
    const expectedResult = options?.expectedResult ?? order.expectedResult

    await deleteOrderByEmail(order.email)

    if (creditScore !== undefined) {
      await mock.creditAnalysis(creditScore)
    }

    await openCheckoutWithBaseCar(order.totalPrice)
    await fillCustomer(order)
    await confirmPayment(order)
    await checkout.expectResult(expectedResult)
  }

  return {
    openCheckoutWithBaseCar,
    fillCustomer,
    confirmPayment,
    completePurchase,
  }
}
