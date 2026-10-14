---
name: Cancelamento atrasado atinge a próxima query do pool
description: KILL QUERY (MySQL) ou pg_cancel_backend disparados sem esperar podem chegar depois que a conexão voltou ao pool e interromper a query de outra pessoa; o adapter espera o cancelamento antes de liberar a conexão.
type: project
category: bug
date: 2026-10-14
---
No MySQL, ao truncar o resultado (N+1 linhas) o adapter disparava `KILL QUERY` por outra conexão sem esperar e devolvia a conexão ao pool. O KILL chegava depois e interrompia a query seguinte naquela conexão; como `SLEEP()` interrompido devolve 1 sem erro, o teste de timeout "passava direto" em 4 ms.

**Problema/Contexto:** falha intermitente no CI (`mysql-adapter.test.ts`, "interrompe por timeout e por cancelamento": promise resolveu em vez de rejeitar).
**Por que importa:** em produção, a query de outra pessoa (outra tela, outra permissão) poderia ser cancelada ou devolver resultado incompleto.
**Como aplicar:** todo KILL/cancelamento fica numa promise (`pendingKill`/`pendingCancel`) aguardada antes do ROLLBACK e da liberação da conexão (`server/datasources/mysql.ts`, `postgres.ts`). Vale para qualquer cancelamento feito por outra conexão.
**Evidência:** log do CI run 14 (2026-10-14); depois da correção, 3 execuções locais seguidas do arquivo passaram.
