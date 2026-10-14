---
name: SQL Server só é testado no CI
description: O pacote mssql-server não baixa no sandbox (proxy 403) e não há Docker; os testes do adapter SQL Server rodam só no CI, com o serviço mcr.microsoft.com/mssql/server:2022-latest.
type: project
category: gotcha
date: 2026-10-14
---
A instalação via apt (`packages.microsoft.com`) volta 403 do proxy do sandbox e não há Docker local. MySQL/MariaDB (apt) e SQLite funcionam localmente.

**Problema/Contexto:** validar o adapter SQL Server (F5).
**Por que importa:** localmente `tests/integration/mssql-adapter.test.ts` fica "skipped" (sem `MSSQL_TEST_HOST`); só o CI prova o adapter.
**Como aplicar:** o CI sobe o serviço SQL Server, roda `node scripts/demo-mssql.mjs` e define `MSSQL_TEST_HOST` e `REQUIRE_DB_TESTS=1`. Depois de mexer em `server/datasources/mssql.ts`, confira o job do CI antes de considerar pronto. Remova repositórios apt da Microsoft que falharem, para não quebrar o `apt-get update`.
**Evidência:** tentativa de instalação em 2026-10-14 bloqueada (403 pmc-geofence).
