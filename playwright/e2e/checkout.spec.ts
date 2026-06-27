import { expect, test } from '../support/fixtures'
import checkoutFixtures from '../support/fixtures/checkout.json' with { type: 'json' }
import { deleteOrderByEmail } from '../support/database/orderRepository'

const CONFIGURATOR_STORAGE_KEY = 'velo-configurator-storage'

test.describe('Checkout', () => {
  test.describe('Validações de campos obrigatórios', () => {
    test.beforeEach(async ({ app }) => {
      await app.checkout.openFromConfigurator()
    })

    test('deve exibir erros ao confirmar pedido com todos os campos em branco', async ({ app }) => {
      await app.checkout.submitOrder()

      await app.checkout.expectStayOnCheckout()
      await app.checkout.expectValidationErrors(
        'Nome deve ter pelo menos 2 caracteres',
        'Sobrenome deve ter pelo menos 2 caracteres',
        'Email inválido',
        'Telefone inválido',
        'CPF inválido',
        'Selecione uma loja',
        'Aceite os termos',
      )
    })

    test('deve exibir erro quando nome e sobrenome têm apenas 1 caractere', async ({ app }) => {
      await app.checkout.fillCustomer({ name: 'A', lastname: 'B' })
      await app.checkout.submitOrder()

      await app.checkout.expectStayOnCheckout()
      await app.checkout.expectValidationErrors(
        'Nome deve ter pelo menos 2 caracteres',
        'Sobrenome deve ter pelo menos 2 caracteres',
      )
    })

    test('deve exibir erro quando o e-mail é inválido', async ({ app }) => {
      await app.checkout.fillCustomer({
        ...checkoutFixtures.validCustomer,
        email: checkoutFixtures.invalidEmail,
      })
      await app.checkout.submitOrderBypassingNativeValidation()

      await app.checkout.expectStayOnCheckout()
      await app.checkout.expectValidationErrors('Email inválido')
    })

    test('deve exibir erro quando o CPF está incompleto', async ({ app }) => {
      const { document: _document, ...customerWithoutDocument } = checkoutFixtures.validCustomer
      await app.checkout.fillCustomer(customerWithoutDocument)
      await app.checkout.submitOrder()

      await app.checkout.expectStayOnCheckout()
      await app.checkout.expectValidationErrors('CPF inválido')
    })

    test('deve exibir erro quando os termos não são aceitos', async ({ app }) => {
      await app.checkout.fillCustomer(checkoutFixtures.validCustomer)
      await app.checkout.submitOrder()

      await app.checkout.expectStayOnCheckout()
      await app.checkout.expectValidationErrors('Aceite os termos')
    })
  })

  test.describe('Pagamento e Confirmação', () => {
    const cashPaymentOrder = {
      customer: {
        name: 'Jedilson',
        lastname: 'Silva',
        email: 'jedilson.silva@velo.dev',
        phone: '(11) 94444-2222',
        document: '779.239.860-96',
        store: 'Velô Paulista - Av. Paulista, 1000',
      },
      expectedTotal: 'R$ 40.000,00',
    } as const

    test.beforeEach(async () => {
      await deleteOrderByEmail(cashPaymentOrder.customer.email)
    })

    test('deve criar pedido aprovado com pagamento à vista', async ({ page, app }) => {
      await page.goto('/')
      await expect(page.getByTestId('landing-page')).toBeVisible()
      await page.evaluate((key) => localStorage.removeItem(key), CONFIGURATOR_STORAGE_KEY)

      await page.getByTestId('hero-cta-primary').click()
      await expect(page).toHaveURL(/\/configure/)
      await expect(page.getByRole('heading', { name: 'Velô Sprint', level: 1 })).toBeVisible()

      await app.configurator.selectExteriorColor('Glacier Blue')
      await app.configurator.selectWheels('aero')
      await app.configurator.expectExteriorPreviewAlt(/aero wheels/)
      await app.configurator.expectPrice(cashPaymentOrder.expectedTotal)

      await page.getByRole('button', { name: 'Monte o Seu' }).click()
      await expect(page).toHaveURL(/\/order/)
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido' })).toBeVisible()

      await app.checkout.fillCustomer(cashPaymentOrder.customer)
      await app.checkout.expectNoValidationErrors()
      await app.checkout.selectCashPayment()
      await app.checkout.expectCashPaymentPrice(cashPaymentOrder.expectedTotal)
      await app.checkout.acceptTerms()
      await app.checkout.submitOrder()
      await app.checkout.expectApprovedOrderSuccess(cashPaymentOrder)
    })
  })
})
