import { test, expect } from '../support/fixtures'
import checkoutFixtures from '../support/fixtures/checkout.json' with { type: 'json' }
import type { CheckoutAlerts } from '../support/actions/checkoutActions'
import type { CheckoutOrder } from '../support/features/checkoutFeature'

test.describe('Checkout', () => {
  test.describe('Validações de campos obrigatórios', () => {
    let alerts: CheckoutAlerts

    test.beforeEach(async ({ page, app }) => {
      await page.goto('/order')
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido' })).toBeVisible()

      alerts = app.checkout.elements.alerts
    })

    test('deve validar obrigatoriedade de todos os campos em branco', async ({ app }) => {
      await app.checkout.submit()

      await expect(alerts.name).toHaveText('Nome deve ter pelo menos 2 caracteres')
      await expect(alerts.lastname).toHaveText('Sobrenome deve ter pelo menos 2 caracteres')
      await expect(alerts.email).toHaveText('Email inválido')
      await expect(alerts.phone).toHaveText('Telefone inválido')
      await expect(alerts.document).toHaveText('CPF inválido')
      await expect(alerts.store).toHaveText('Selecione uma loja')
      await expect(alerts.terms).toHaveText('Aceite os termos')
    })

    test('deve validar limite mínimo de caracteres para Nome e Sobrenome', async ({ app }) => {
      const customer = checkoutFixtures.shortNameCustomer

      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      await expect(alerts.name).toHaveText('Nome deve ter pelo menos 2 caracteres')
      await expect(alerts.lastname).toHaveText('Sobrenome deve ter pelo menos 2 caracteres')
    })

    test('deve exibir erro para e-mail com formato inválido', async ({ app }) => {
      const customer = checkoutFixtures.invalidEmailCustomer

      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      await expect(alerts.email).toHaveText('Email inválido')
    })

    test('deve exibir erro para CPF inválido', async ({ app }) => {
      const customer = checkoutFixtures.invalidCpfCustomer

      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)
      await app.checkout.acceptTerms()
      await app.checkout.submit()

      await expect(alerts.document).toHaveText('CPF inválido')
    })

    test('deve exigir o aceite dos termos ao finalizar com dados válidos', async ({ app }) => {
      const customer = checkoutFixtures.termsCustomer

      await app.checkout.fillCustomerlData(customer)
      await app.checkout.selectStore(customer.store)

      await expect(app.checkout.elements.terms).not.toBeChecked()

      await app.checkout.submit()

      await expect(alerts.terms).toHaveText('Aceite os termos')
    })
  })

  test.describe('Pagamento e Confirmação', () => {
    test.beforeEach(async ({ app }) => {
      await app.hero.open()
    })

    test('deve criar um pedido com sucesso para pagamento à vista', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.cashOrder as CheckoutOrder)
    })

    test('deve aprovar automaticamente o crédito quando o score do CPF for maior que 700 no financiamento', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.highScoreOrder as CheckoutOrder)
    })

    test('deve encaminhar para análise de crédito quando o score do CPF for entre 501 e 700 no financiamento', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.midScoreOrder as CheckoutOrder)
    })

    test('deve reprovar o crédito quando o score do CPF for menor ou igual a 500 no financiamento sem entrada', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.lowScoreNoEntry as CheckoutOrder)
    })

    test('deve reprovar o crédito quando o score do CPF for menor ou igual a 500 no financiamento com entrada menor que 50%', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.lowScoreLowEntry as CheckoutOrder)
    })

    test('deve reprovar o crédito quando o score do CPF for menor ou igual a 500 no financiamento com entrada igual a 50%', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.lowScoreHalfEntry as CheckoutOrder)
    })

    test('deve aprovar o crédito quando o score do CPF for menor ou igual a 500 no financiamento com entrada mais que 50%', async ({ app }) => {
      await app.checkoutFeature.completePurchase(checkoutFixtures.lowScoreHighEntry as CheckoutOrder)
    })
  })
})
