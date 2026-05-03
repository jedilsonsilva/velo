# Support — Actions + Fixtures

## Mapeamento (Page Object → Actions)

| Contexto      | Page Object original              | Actions nova                          |
|-------------|------------------------------------|----------------------------------------|
| Consulta pedido | `pages/OrderLockupPage.ts` (legado) | `actions/orderLookupActions.ts` → `createOrderLookupActions` |
| Configurador | — | `actions/configuratorActions.ts` → `createConfiguratorActions` → `app.configurator` |

Legado movido para: `playwright/backup/legacy/OrderLockupPage.ts`

## Como usar

- **Criar nova action:** em `support/actions/<contexto>Actions.ts` defina `create<Contexto>Actions(page: Page)` que retorna um objeto com métodos async (sem `class`/`this`).
- **Registrar na fixture:** em `support/fixtures.ts` importe a factory e adicione ao tipo `App` e ao objeto `app` dentro do `extend` (ex.: `orderLookup: createOrderLookupActions(page)`).
- **No teste:** importe `{ test, expect } from '../support/fixtures'` e use `async ({ app }) => { ... }`; chame `app.orderLookup.searchOrder(...)`, `app.configurator.open(...)`, etc.
