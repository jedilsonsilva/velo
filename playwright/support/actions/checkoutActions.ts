import { Page, expect } from '@playwright/test'

export type CheckoutCustomerData = {
  name?: string
  lastname?: string
  email?: string
  phone?: string
  document?: string
}

export function createCheckoutActions(page: Page) {
  const nameInput = page.getByTestId('checkout-name')
  const lastnameInput = page.getByTestId('checkout-lastname')
  const emailInput = page.getByTestId('checkout-email')
  const phoneInput = page.getByTestId('checkout-phone')
  const documentInput = page.getByTestId('checkout-document')
  const storeTrigger = page.getByTestId('checkout-store')
  const termsCheckbox = page.getByTestId('checkout-terms')
  const submitButton = page.getByRole('button', { name: 'Confirmar Pedido' })
  const entryValueInput = page.getByTestId('input-entry-value')

  const elements = {
    terms: termsCheckbox,
    alerts: {
      name: page.getByTestId('checkout-name-error'),
      lastname: page.getByTestId('checkout-lastname-error'),
      email: page.getByTestId('checkout-email-error'),
      phone: page.getByTestId('checkout-phone-error'),
      document: page.getByTestId('checkout-document-error'),
      store: page.getByTestId('checkout-store-error'),
      terms: page.getByTestId('checkout-terms-error'),
    },
  }

  return {
    elements,

    async expectLoaded() {
      await expect(page).toHaveURL(/\/order/)
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido' })).toBeVisible()
    },

    async fillCustomerlData(customer: CheckoutCustomerData) {
      if (customer.name !== undefined) await nameInput.fill(customer.name)
      if (customer.lastname !== undefined) await lastnameInput.fill(customer.lastname)
      if (customer.email !== undefined) await emailInput.fill(customer.email)
      if (customer.phone !== undefined) await phoneInput.fill(customer.phone)
      if (customer.document !== undefined) await documentInput.fill(customer.document)
    },

    async selectStore(store: string) {
      await storeTrigger.click()
      await page.getByRole('option', { name: store }).click()
    },

    async acceptTerms() {
      await termsCheckbox.click()
    },

    async selectPaymentMethod(method: string) {
      if (method === 'À Vista') {
        await page.getByTestId('payment-avista').click()
        return
      }

      if (method === 'Financiamento') {
        await page.getByTestId('payment-financiamento').click()
        return
      }

      throw new Error(`Método de pagamento não suportado: ${method}`)
    },

    async fillDownPayment(value: string) {
      await entryValueInput.fill(value)
    },

    async expectSummaryTotal(total: string) {
      await expect(page.getByTestId('summary-total-price')).toHaveText(total)
    },

    async submit() {
      // Desabilita validação HTML5 para que o Zod exiba os alerts esperados nos testes
      await page.locator('form').evaluate((form) => {
        form.noValidate = true
        form.requestSubmit()
      })
    },

    async expectResult(status: string) {
      await expect(page).toHaveURL(/\/success/)
      await expect(page.getByTestId('success-status')).toHaveText(status)
    },
  }
}

export type CheckoutActions = ReturnType<typeof createCheckoutActions>
export type CheckoutAlerts = CheckoutActions['elements']['alerts']
