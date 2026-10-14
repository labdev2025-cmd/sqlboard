# sqlboard

Plataforma web *SQL-first* para equipes montarem ferramentas internas e painéis a partir de queries prontas.

1. Conecte um banco relacional (PostgreSQL primeiro; depois MySQL, SQLite e SQL Server).
2. Escreva a query. Parâmetros como `:placa` ou `{{data_inicio}}` viram campos de entrada automaticamente.
3. Monte a tela arrastando e soltando tabelas, gráficos, KPIs, filtros e botões, com visual shadcn/ui.
4. Publique e compartilhe com a equipe.

> **Status:** em construção por fases (veja `docs/ROADMAP.md`).

## Como rodar (desenvolvimento)

Pré-requisitos: Node.js 22+, pnpm 10 e PostgreSQL 16 (serviço local **ou** Docker).

```bash
pnpm install
cp .env.example .env        # ajuste as chaves (veja os comentários no arquivo)
bash scripts/dev-setup.sh   # sobe/configura o Postgres, banco demo, migrações e seed
pnpm dev                    # http://localhost:3000
```

Sem PostgreSQL local, `docker compose up -d postgres` sobe um banco e o `dev-setup.sh` usa-o automaticamente quando o Docker estiver disponível (ou defina `ADMIN_DATABASE_URL`).

No primeiro acesso, a tela de login pede para **criar o administrador**. Depois disso o cadastro público fecha: novas contas são criadas pelo admin em **Administração → Usuários**.

O seed cria a conexão **Demo**, ligada ao banco `sqlboard_demo` (uma loja **fictícia** com clientes, produtos e pedidos de dois anos) por um usuário somente leitura.

### Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | Qualidade |
| `pnpm test` | Testes de unidade e integração (Vitest, Postgres real) |
| `pnpm build` e `pnpm start` | Build de produção (standalone) e servidor |
| `pnpm test:e2e` | Testes de ponta a ponta (Playwright + axe) sobre o build |
| `pnpm db:generate --name <nome>` / `pnpm db:migrate` / `pnpm db:seed` | Migrações e seed |

## Como o projeto é construído

| Arquivo | Papel |
| --- | --- |
| `PROMPT.md` | Prompt de construção: visão, arquitetura, regras de segurança e protocolo de cada sessão |
| `docs/ROADMAP.md` | Fases, critérios de aceite e status |
| `docs/AUDITORIA.md` | Resumo de cada passada de auditoria |
| `AGENTS.md` / `CLAUDE.md` | Instruções do projeto para agentes de IA |
| `LEARNING.md` + `docs/learning/` | Aprendizados registrados durante o desenvolvimento |
| `docs/guides/` | Guias de UI (shadcn/ui), responsividade, contexto e commits |

Para construir ou revisar o projeto, numa sessão do Claude Code (local ou na nuvem) com este repositório:

```text
execute o PROMPT.md
```

Cada execução constrói tudo o que falta no roadmap e depois faz uma passada de auditoria (revisa, corrige, refatora), commitando direto na `main`.

## Segurança

O sqlboard executa SQL contra bancos reais. Além das proteções da aplicação (somente leitura, timeout, limite de linhas, parâmetros sempre separados do SQL), **cadastre conexões com um usuário de banco que só tenha permissão de leitura (SELECT)**, de preferência com `default_transaction_read_only = on`. A transação somente leitura sozinha não basta: extensões como `dblink` podem abrir outra conexão.

- Senhas de conexão são cifradas com AES-256-GCM (`SQLBOARD_ENCRYPTION_KEY`) e nunca voltam para o navegador.
- Toda checagem de permissão (papel, conexão, tela) é feita no servidor.
- Nenhum segredo real fica no repositório; use `.env.example` como modelo.

## Bancos suportados

| Recurso | PostgreSQL | MySQL / MariaDB | SQLite | SQL Server |
| --- | --- | --- | --- | --- |
| Driver | `pg` + `pg-cursor` | `mysql2` | `better-sqlite3` | `mssql` (tedious) |
| Parâmetros | `$1` (protocolo estendido) | `?` (prepared statement no servidor) | `?` (statement preparado) | `@p1` (RPC parametrizado) |
| Somente leitura | `BEGIN READ ONLY` | `START TRANSACTION READ ONLY` | arquivo aberto `readonly` + `query_only` | transação sempre desfeita (`ROLLBACK`) |
| Tempo limite | `statement_timeout` + `pg_cancel_backend` | `max_execution_time` / `max_statement_time` + `KILL QUERY` + timer no cliente | worker encerrado | timer no cliente + cancelamento do request |
| Cancelamento | sim | sim | sim | sim |
| Explorador de schema | sim | sim | sim | sim |
| EXPLAIN | sim | sim | `EXPLAIN QUERY PLAN` | não |
| Testado em | CI e local | CI (MySQL 8.4) e local (MariaDB 10.11) | CI e local | CI (SQL Server 2022) |

Limitações conhecidas:

- **SQL Server** não tem transação somente leitura: o sqlboard sempre desfaz a transação, mas comandos que não respeitam transação (ex.: `xp_cmdshell`, linked servers) só são barrados pelas permissões do usuário. Use um login só com `db_datareader`.
- **MySQL/MariaDB**: DDL faz *commit* implícito e escapa da transação; por isso o sqlboard só aceita um único comando que comece com `SELECT`, `WITH`, `VALUES`, `TABLE`, `SHOW`, `DESCRIBE`/`DESC` ou `EXPLAIN` (vale para todos os bancos), e mesmo assim o usuário do banco deve ter só `SELECT`. `max_execution_time` do MySQL vale só para `SELECT`; o timer do cliente cobre o resto.
- **SQLite**: o arquivo precisa estar dentro de `SQLBOARD_SQLITE_DIR` (padrão `data/sqlite`); caminhos fora dela são recusados. Cada execução roda numa *worker thread* para não travar o servidor.
- **Oracle** ainda não é suportado (não há como testá-lo neste ambiente).
