# sqlboard

Plataforma web *SQL-first* para equipes montarem ferramentas internas e painéis a partir de queries prontas.

1. Conecte um banco relacional (PostgreSQL primeiro; depois MySQL, SQLite e SQL Server).
2. Escreva a query. Parâmetros como `:placa` ou `{{data_inicio}}` viram campos de entrada automaticamente.
3. Monte a tela arrastando e soltando tabelas, gráficos, KPIs, filtros e botões, com visual shadcn/ui.
4. Publique e compartilhe com a equipe.

> **Status:** fases F0 a F6 concluídas (veja `docs/ROADMAP.md` e `docs/AUDITORIA.md`). Para colocar em produção, siga `docs/DEPLOY.md`.

## O que dá para fazer

- **Conexões** com PostgreSQL, MySQL/MariaDB, SQLite e SQL Server, com senha cifrada e acesso por pessoa.
- **Editor SQL** com parâmetros tipados automáticos, cláusulas opcionais `[[ ... ]]`, cancelamento, explorador de schema, histórico de versões e "Melhorar com IA" por copiar e colar.
- **Telas** montadas por arrastar e soltar (tabelas, gráficos, KPIs, filtros, botões), com filtros encadeados, várias páginas, publicação com versões, compartilhamento e exportação CSV/XLSX. "Gerar tela automática" e "Gerar com IA" criam uma proposta pronta.
- **Agendamentos**: uma query ou tela enviada por e-mail (CSV, XLSX ou PDF) em intervalos regulares.
- **Ações de escrita**: formulários com INSERT/UPDATE revisados por um administrador, com prévia, confirmação, limite de linhas e auditoria.
- **Importar/exportar telas em JSON** e versionar em git (`pnpm apps:pull` / `pnpm apps:push`).
- **Servidor MCP** (`/api/mcp`) para agentes de IA criarem e editarem rascunhos de telas com os seus acessos, por token.

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
| `pnpm apps:pull <pasta>` / `pnpm apps:push <pasta>` | Baixa/envia telas em JSON para versionar em git (`SQLBOARD_URL` e `SQLBOARD_TOKEN`) |
| `pnpm keys:rotate` | Recifra as senhas de conexão depois de trocar `SQLBOARD_ENCRYPTION_KEY` |

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
- Nenhum segredo real fica no repositório; use `.env.example` como modelo. Em produção o servidor não sobe com os valores de exemplo.
- Leitores de uma tela recebem só o resultado: o SQL e a conexão das queries ficam no servidor.
- Ações de escrita usam uma conexão separada (uso "Escrita controlada"), só aceitam um INSERT/UPDATE (UPDATE sempre com WHERE), rodam numa transação, são desfeitas acima do limite de linhas e só gravam depois da prévia confirmada.
- Tokens de API (MCP e scripts) guardam só o hash, expiram, não administram usuários, conexões nem ações e são revogados ao redefinir a senha.
- Login com limite de tentativas por IP e por conta, guardado no banco.

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

- **SQL Server** não tem transação somente leitura e executa o lote inteiro sem precisar de `;`. O sqlboard sempre desfaz a transação, recusa palavras que iniciam outro comando (`COMMIT`, `UPDATE`, `EXEC`, `INTO`, `WAITFOR`, `OPENROWSET`…) e confere se a transação continua aberta; mesmo assim, **use um login só com `db_datareader`**: é a defesa principal.
- **MySQL/MariaDB**: DDL faz *commit* implícito e escapa da transação; por isso o sqlboard só aceita um único comando que comece com `SELECT`, `WITH`, `VALUES`, `TABLE`, `SHOW`, `DESCRIBE`/`DESC` ou `EXPLAIN` (vale para todos os bancos), recusa `INTO OUTFILE`/`LOAD_FILE`, e mesmo assim o usuário do banco deve ter só `SELECT`. `max_execution_time` do MySQL vale só para `SELECT`; o timer do cliente cobre o resto. Variáveis e locks de sessão são limpos antes de a conexão voltar ao pool.
- **Parâmetros de lista** (`multi`): escreva `IN (:lista)` em qualquer banco; no PostgreSQL vira `= ANY($1)` automaticamente.
- **SQLite**: o arquivo precisa estar dentro de `SQLBOARD_SQLITE_DIR` (padrão `data/sqlite`); caminhos fora dela são recusados. Cada execução roda numa *worker thread* para não travar o servidor.
- **Oracle** ainda não é suportado (não há como testá-lo neste ambiente).
