---
name: Rollback no SQL Server com request ativo vaza conexão
description: No mssql, resolver a promise antes do evento "done" faz o rollback falhar com EREQINPROG; a conexão nunca volta ao pool e o close() trava.
type: project
category: bug
date: 2026-10-14
---
O adapter SQL Server roda cada query numa transação que sempre é desfeita. A primeira versão resolvia/rejeitava no evento `error` ou ao ler N+1 linhas, enquanto o request ainda estava ativo. O `tx.rollback()` então falhava com `EREQINPROG` (erro engolido), a conexão ficava presa na transação e `pool.close()` travava (afterAll com timeout de 60 s no CI).

**Problema/Contexto:** CI (job com SQL Server 2022) falhou com "Hook timed out in 60000ms" no `afterAll` de `tests/integration/mssql-adapter.test.ts`.
**Por que importa:** em produção cada erro ou truncamento consumiria uma conexão do pool até esgotá-lo.
**Como aplicar:** no modo stream do `mssql`, `done` sempre vem depois de `error`; acumule erro/truncamento e decida só no `done` (ver `server/datasources/mssql.ts`). Não use `request.pause()` antes de `cancel()`.
**Evidência:** log do CI run 7 (2026-10-14) e código de `mssql/lib/base/transaction.js` (`_rollback` recusa com request ativo).
