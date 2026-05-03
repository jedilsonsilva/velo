import { test } from '../support/fixtures'

test.describe('Configuração do Veículo', () => {
  test.beforeEach(async ({ app }) => {
    await app.configurator.openClearingPersistedConfigurator()
  })

  test('deve atualizar a pré-visualização do veículo ao alterar a cor exterior, sem mudar o preço', async ({ app }) => {
    await app.configurator.selectExteriorColor('Midnight Black')
    await app.configurator.expectExteriorPreviewAlt(/midnight-black/)
    await app.configurator.expectPrice('R$ 40.000,00')

    await app.configurator.selectExteriorColor('Lunar White')
    await app.configurator.expectExteriorPreviewAlt(/lunar-white/)
    await app.configurator.expectPrice('R$ 40.000,00')

    await app.configurator.selectExteriorColor('Glacier Blue')
    await app.configurator.expectExteriorPreviewAlt(/glacier-blue/)
    await app.configurator.expectPrice('R$ 40.000,00')
  })

  test('deve atualizar a pré-visualização e o preço ao alterar as rodas', async ({ app }) => {
    await app.configurator.expectExteriorPreviewAlt(/aero wheels/)
    await app.configurator.expectPrice('R$ 40.000,00')

    await app.configurator.selectWheels('sport')
    await app.configurator.expectExteriorPreviewAlt(/sport wheels/)
    await app.configurator.expectPrice('R$ 42.000,00')

    await app.configurator.selectWheels('aero')
    await app.configurator.expectExteriorPreviewAlt(/aero wheels/)
    await app.configurator.expectPrice('R$ 40.000,00')
  })

  test('deve atualizar o preço dinamicamente ao selecionar itens opcionais', async ({ app }) => {
    await app.configurator.expectPrice('R$ 40.000,00')

    await app.configurator.selectWheels('sport')
    await app.configurator.expectPrice('R$ 42.000,00')

    await app.configurator.checkOptional('Precision Park')
    await app.configurator.expectPrice('R$ 47.500,00')

    await app.configurator.checkOptional('Flux Capacitor')
    await app.configurator.expectPrice('R$ 52.500,00')

    await app.configurator.selectWheels('aero')
    await app.configurator.expectPrice('R$ 50.500,00')
  })
})
