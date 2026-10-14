---
name: MySQL encerra SLEEP interrompido sem erro
description: KILL QUERY e max_execution_time fazem SLEEP() devolver 1 sem erro no MySQL, e max_execution_time só vale para SELECT; o adapter usa timer no cliente e trata a execução interrompida como falha.
type: project
category: gotcha
date: 2026-10-14
---
No MySQL, `SELECT SLEEP(n)` interrompido por `KILL QUERY` ou por `max_execution_time` termina normalmente devolvendo 1; no MariaDB o mesmo caso gera erro. `max_execution_time` também não cobre comandos que não são `SELECT`.

**Problema/Contexto:** com só o limite do servidor, cancelamento e timeout poderiam aparecer como sucesso no MySQL 8 (testado localmente só em MariaDB 10.11).
**Por que importa:** o usuário veria um resultado parcial ou falso em vez de "cancelado"/"tempo esgotado".
**Como aplicar:** `server/datasources/mysql.ts` liga um timer no cliente que faz `KILL QUERY`, e no fim do comando verifica as flags `cancelled`/`timedOut` antes de devolver o resultado. O limite do servidor fica 1 s **depois** do timer do cliente (só como reserva): com os dois iguais, o MySQL 8.4 interrompia o SLEEP primeiro e o resultado voltava como sucesso.
**Evidência:** documentação do MySQL (função SLEEP); teste "interrompe por timeout e por cancelamento" em `tests/integration/mysql-adapter.test.ts` falhou no CI run 20 (MySQL 8.4, `durationMs: 502`, linha `1`) com limites iguais e passa com o servidor como reserva.
