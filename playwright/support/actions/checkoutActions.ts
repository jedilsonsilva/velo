import { Page, expect } from '@playwright/test'

export type CheckoutCustomer = {
  name: string
  lastname: string
  email: string
  phone: string
  document: string
  store: string
}

const CONFIGURATOR_STORAGE_KEY = 'velo-configurator-storage'

export function createCheckoutActions(page: Page) {
  const nameInput = page.getByTestId('checkout-name')
  const lastnameInput = page.getByTestId('checkout-lastname')
  const emailInput = page.getByTestId('checkout-email')
  const phoneInput = page.getByTestId('checkout-phone')
  const documentInput = page.getByTestId('checkout-document')
  const storeTrigger = page.getByTestId('checkout-store')
  const termsCheckbox = page.getByTestId('checkout-terms')
  const submitButton = page.getByRole('button', { name: 'Confirmar Pedido' })

  return {
    async openFromConfigurator() {
      await page.goto('/')
      await page.evaluate((key: string) => localStorage.removeItem(key), CONFIGURATOR_STORAGE_KEY)
      await page.goto('/configure')
      await expect(page.getByRole('heading', { name: 'Velô Sprint', level: 1 })).toBeVisible()
      await page.getByRole('button', { name: 'Monte o Seu' }).click()
      await expect(page).toHaveURL(/\/order/)
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido' })).toBeVisible()
    },

    async fillCustomer(customer: Partial<CheckoutCustomer>) {
      if (customer.name !== undefined) await nameInput.fill(customer.name)
      if (customer.lastname !== undefined) await lastnameInput.fill(customer.lastname)
      if (customer.email !== undefined) await emailInput.fill(customer.email)
      if (customer.phone !== undefined) await phoneInput.fill(customer.phone)
      if (customer.document !== undefined) await documentInput.fill(customer.document)
      if (customer.store !== undefined) {
        await storeTrigger.click()
        await page.getByRole('option', { name: customer.store }).click()
      }
    },

    async acceptTerms() {
      await termsCheckbox.click()
    },

    async selectCashPayment() {
      await page.getByTestId('payment-avista').click()
    },

    async expectNoValidationErrors() {
      await expect(page.getByTestId(/checkout-.*-error/)).toHaveCount(0)
    },

    async expectCashPaymentPrice(price: string) {
      await expect(page.getByTestId('payment-avista')).toContainText(price)
      await expect(page.getByTestId('summary-total-price')).toHaveText(price)
    },

    async expectApprovedOrderSuccess(params: {
      customer: CheckoutCustomer
      expectedTotal: string
    }) {
      await expect(page).toHaveURL(/\/success/)
      await expect(page.getByTestId('success-status')).toHaveText('Pedido Aprovado!')
      await expect(page.getByTestId('order-id')).toHaveText(/^VLO-[A-Z0-9]{6}$/)
      await expect(page.getByRole('heading', { name: 'Velô Sprint', level: 3 })).toBeVisible()
      await expect(page.getByText(params.expectedTotal)).toBeVisible()
      await expect(page.getByText(`${params.customer.name} ${params.customer.lastname}`)).toBeVisible()
      await expect(page.getByText(params.customer.email)).toBeVisible()
      await expect(page.getByText(params.customer.store)).toBeVisible()
    },

    async submitOrder() {
      await submitButton.click()
    },

    /** Dispara validação Zod quando o HTML5 bloqueia o submit (ex.: email inválido). */
    async submitOrderBypassingNativeValidation() {
      await page.locator('form').evaluate((form) => {
        form.noValidate = true
        form.requestSubmit()
      })
    },

    async expectStayOnCheckout() {
      await expect(page).toHaveURL(/\/order/)
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido', level: 1 })).toBeVisible()
    },

    async expectValidationErrors(...messages: string[]) {
      for (const message of messages) {
        const pattern = new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
        await expect(page.getByTestId(/checkout-.*-error/).filter({ hasText: pattern })).toBeVisible()
      }
    },
  }
}
