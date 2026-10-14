---
name: Worker do SQLite não acha o better-sqlite3 no build
description: require.resolve dentro do código empacotado vira id numérico do bundler; o worker resolve o driver pelo nome a partir do cwd, com fallback para .next/node_modules.
type: project
category: bug
date: 2026-10-14
---
O adapter SQLite roda cada operação numa worker thread (`eval: true`). A primeira versão calculava o caminho do driver no thread principal com `createRequire(import.meta.url).resolve("better-sqlite3")`; no build do Next (Turbopack) essa chamada vira o id interno do módulo e o worker falhava com `The "id" argument must be of type string. Received type number`.

**Problema/Contexto:** "Testar conexão" de SQLite falhava só no build (`pnpm start`/e2e); os testes Vitest passavam.
**Por que importa:** o bundler reescreve `require.resolve` com string literal; o erro não aparece em testes fora do Next.
**Como aplicar:** a resolução fica dentro do código-fonte do worker (fora do bundle): `require.resolve("better-sqlite3", { paths: [process.cwd()] })` e, no standalone, o externo com hash em `.next/node_modules/better-sqlite3-<hash>`. `server/datasources/sqlite.ts` mantém `import "better-sqlite3"` para o standalone rastrear o pacote.
**Evidência:** `tests/e2e/multi-db.e2e.ts` falhava e passa; cópia isolada de `.next/standalone` carrega o driver pelo fallback (2026-10-14).
