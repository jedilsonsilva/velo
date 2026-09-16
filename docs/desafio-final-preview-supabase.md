# Desafio Final — decisões de pipeline (Preview isolado + produção)

## Problema
`VITE_SUPABASE_*` são embutidas no JavaScript em **tempo de build**. Promover o mesmo artefato gerado com env **Preview** faria a produção continuar falando com o Supabase de preview.

## Escolha (Tarefa 4 — Caminho B)
Após os E2E passarem no preview, o job `deploy-production` faz:

1. `vercel pull --environment=production`
2. `vercel build --prod` (bundle com `VITE_*` de **produção**; sem `--prod` o artefato fica marcado como preview)
3. `vercel deploy --prebuilt --prod`

Assim produção sempre usa o Supabase de produção, independentemente do build de preview.

## Isolamento dos E2E
O job `e2e-tests` usa:

- `BASE_URL` = URL do deploy de preview
- `DATABASE_URL` = secret `DATABASE_URL_PREVIEW` (Postgres do Supabase preview)

Pedidos criados pelos testes não devem aparecer no banco de produção.

## Secrets necessários no GitHub
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`
- `TESTDINO_TOKEN` (opcional para streaming)
- `DATABASE_URL_PREVIEW` — connection string do Session pooler do projeto Supabase **preview**