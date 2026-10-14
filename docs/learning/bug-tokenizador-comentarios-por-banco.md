---
name: Validador de SQL precisa ler comentários e aspas como cada banco
description: Qualquer diferença entre o tokenizador e o lexer do banco esconde código dentro de um "comentário" ou "texto"; SQL Server aninha /* */, MySQL executa /*! */, exige espaço após -- e aceita barra invertida em "...".
type: project
category: bug
date: 2026-10-14
---
O tokenizador (`lib/sql-params/tokenizer.ts`) só aninhava `/* */` no PostgreSQL. No SQL Server, `SELECT 1 /* /* */ ' */ COMMIT UPDATE t SET x=1 BEGIN TRAN --'` passava pela validação: o tokenizador fechava o comentário no primeiro `*/`, lia o resto como texto entre aspas e não via `COMMIT`/`UPDATE`; o banco executava tudo. No MySQL, `/*! INTO OUTFILE */`, `1 --1, LOAD_FILE(...)` e `"\"" INTO OUTFILE` escapavam da regra de arquivos pelo mesmo motivo.

**Problema/Contexto:** auditoria de segurança de 2026-10-14 (revisão por leitura, confirmada com testes do tokenizador).
**Por que importa:** o validador é a defesa contra lote com mais de um comando no SQL Server e contra leitura/gravação de arquivos no MySQL; um desvio de lexer anula a defesa.
**Como aplicar:** a regra de cada região protegida segue o banco (`scanProtected`): aninhamento de `/* */` em PostgreSQL e SQL Server; no MySQL `--` só com espaço/controle depois, `"..."` com barra invertida, `/*!`/`/*M!` e `SET_VAR` recusados. Trechos sem fechamento são recusados em todos os bancos. O adapter MySQL remove `ANSI_QUOTES`, `NO_BACKSLASH_ESCAPES` e modos que os incluem do `sql_mode` da sessão, para o servidor ler aspas como o validador. Ao mudar o tokenizador ou adicionar um dialeto, escreva o teste de ataque correspondente em `tests/unit/sql-params.test.ts`.
**Evidência:** testes "comentários aninhados não escondem outro comando", "comentários executáveis…" e "recusa comentário, texto ou identificador sem fechamento"; CI verde com SQL Server 2022 e MySQL 8.4 no commit `7e6bbb0`.
