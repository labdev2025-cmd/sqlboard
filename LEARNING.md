# LEARNING.md — base de conhecimento do projeto

Leia as entradas relacionadas à tarefa. Os detalhes ficam em `docs/learning/`.

## Bugs e soluções
- [Worker do SQLite não acha o driver no build](docs/learning/bug-sqlite-worker-modulo-bundler.md) — require.resolve vira id do bundler; resolver dentro do código do worker.

## Pegadinhas de ambiente, dependências e bibliotecas
- [Registry do shadcn bloqueado no sandbox](docs/learning/gotcha-shadcn-registry-bloqueado.md) — rode o site do shadcn local (GitHub) e use REGISTRY_URL.
- [TypeScript 6 e ESLint 9 fixados](docs/learning/gotcha-versoes-typescript-eslint.md) — typescript-eslint exige TS < 6.1; eslint-plugin-react aceita ESLint ≤ 9.
- [Rate limit do Better Auth no e2e](docs/learning/gotcha-better-auth-rate-limit-e2e.md) — logins seguidos viram 429; o e2e desliga com SQLBOARD_AUTH_RATE_LIMIT=off.
- [MySQL encerra SLEEP interrompido sem erro](docs/learning/gotcha-mysql-sleep-interrompido.md) — timer no cliente + flags de cancelado/timeout no adapter.
- [SQL Server só é testado no CI](docs/learning/gotcha-sql-server-so-no-ci.md) — apt bloqueado e sem Docker; serviço no CI com REQUIRE_DB_TESTS=1.
- [Chromium do Playwright no sandbox](docs/learning/gotcha-playwright-chromium-sandbox.md) — use PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium.

## Decisões de arquitetura
- [Estrutura sem src/ e API em Route Handlers](docs/learning/decision-estrutura-sem-src.md) — convenção do template shadcn; permissões centralizadas em server/http.ts e services.

## Abordagens que NÃO funcionaram

## Notas de performance

## Referências externas
