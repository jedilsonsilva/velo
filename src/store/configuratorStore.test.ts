import { describe, expect, it } from 'vitest'
import {
  calculateInstallment,
  calculateTotalPrice,
  formatPrice,
  type CarConfiguration,
} from './configuratorStore'

const baseConfig = (): CarConfiguration => ({
  exteriorColor: 'glacier-blue',
  interiorColor: 'carbon-black',
  wheelType: 'aero',
  optionals: [],
})

describe('configuratorStore pure functions', () => {
  describe('calculateTotalPrice', () => {
    it('retorna o preço base com rodas aero e sem opcionais', () => {
      expect(calculateTotalPrice(baseConfig())).toBe(40000)
    })

    it('adiciona o valor das rodas sport', () => {
      expect(
        calculateTotalPrice({
          ...baseConfig(),
          wheelType: 'sport',
        }),
      ).toBe(42000)
    })

    it('soma Precision Park ao total', () => {
      expect(
        calculateTotalPrice({
          ...baseConfig(),
          optionals: ['precision-park'],
        }),
      ).toBe(45500)
    })

    it('soma Flux Capacitor ao total', () => {
      expect(
        calculateTotalPrice({
          ...baseConfig(),
          optionals: ['flux-capacitor'],
        }),
      ).toBe(45000)
    })

    it('soma rodas sport e todos os opcionais', () => {
      expect(
        calculateTotalPrice({
          ...baseConfig(),
          wheelType: 'sport',
          optionals: ['precision-park', 'flux-capacitor'],
        }),
      ).toBe(52500)
    })

    it('ignora opcionais inválidos e trata optionals não-array', () => {
      expect(
        calculateTotalPrice({
          ...baseConfig(),
          optionals: ['precision-park', 'invalid-optional' as never],
        }),
      ).toBe(45500)

      expect(
        calculateTotalPrice({
          ...baseConfig(),
          optionals: undefined as never,
        }),
      ).toBe(40000)
    })
  })

  describe('calculateInstallment', () => {
    it('calcula parcela 12x com juros compostos de 2% a.m. para o preço base', () => {
      expect(calculateInstallment(40000)).toBe(3782.38)
    })

    it('calcula parcela para configuração com rodas sport', () => {
      expect(calculateInstallment(42000)).toBe(3971.5)
    })

    it('calcula parcela para total com opcionais', () => {
      expect(calculateInstallment(50500)).toBe(4775.26)
    })
  })

  describe('formatPrice', () => {
    it('formata valores em BRL no padrão pt-BR', () => {
      expect(formatPrice(40000)).toBe(
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(40000),
      )
      expect(formatPrice(42000)).toBe(
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(42000),
      )
      expect(formatPrice(3782.38)).toBe(
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(3782.38),
      )
    })

    it('formata zero corretamente', () => {
      expect(formatPrice(0)).toBe(
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0),
      )
    })
  })
})
