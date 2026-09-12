# Support — Actions + Fixtures

## Camadas

| Camada | Pasta | Responsabilidade |
|--------|-------|------------------|
| Page Actions | `support/actions/` | Interações atômicas de uma tela (`fill`, `click`, asserts locais) |
| Feature Actions | `support/features/` | Jornadas de negócio que orquestram várias page actions |
| Fixtures de dados | `support/fixtures/*.json` | Dados de cenário reutilizáveis |
| Specs | `e2e/` | Cenário + asserts de negócio (fino) |

## Mapeamento

| Contexto | Actions / Feature | Uso no teste |
|----------|-------------------|--------------|
| Consulta pedido | `actions/orderLookupActions.ts` | `app.orderLookup` |
| Configurador | `actions/configuratorActions.ts` | `app.configurator` |
| Checkout (página) | `actions/checkoutActions.ts` | `app.checkout` |
| Checkout (jornada) | `features/checkoutFeature.ts` | `app.checkoutFeature` |
| Hero / Mock | `actions/heroActions.ts`, `actions/mockActions.ts` | `app.hero`, `app.mock` |

Legado movido para: `playwright/backup/legacy/OrderLockupPage.ts`

## Como usar

- **Page action:** em `support/actions/<contexto>Actions.ts` defina `create<Contexto>Actions(page: Page)` que retorna métodos async (sem `class`/`this`).
- **Feature action:** em `support/features/<contexto>Feature.ts` defina uma factory que recebe as page actions necessárias e retorna jornadas (`completePurchase`, etc.).
- **Registrar:** em `support/fixtures.ts` importe a factory e adicione ao tipo `App` e ao objeto `app`.
- **No teste:** importe `{ test, expect } from '../support/fixtures'` e use `async ({ app }) => { ... }`.

Exemplo (pagamento):

```ts
await app.hero.open()
await app.checkoutFeature.completePurchase(checkoutFixtures.highScoreOrder)
```
