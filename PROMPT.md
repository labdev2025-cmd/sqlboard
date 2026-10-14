# PROMPT.md — construção do sqlboard

> **Para o agente.** Este é o prompt de construção do projeto. Quando o usuário disser "execute o PROMPT.md" (ou equivalente), leia este arquivo inteiro e siga o **Protocolo de sessão** (§1). O objetivo de **cada** execução é deixar o projeto **inteiro** pronto: construir tudo o que falta no `docs/ROADMAP.md`, na mesma sessão, sem parar entre fases. O usuário vai repetir este mesmo pedido muitas vezes; cada nova execução é uma **passada** que audita o que já existe contra este prompt, corrige, refatora e completa o que faltar. O prompt é idempotente: rodá-lo de novo nunca deve desfazer trabalho correto.

Revisão: 2026-10-14. Pesquisa de mercado, bibliotecas e versões feita nessa data. Versões mudam: confirme no registro do npm e na documentação instalada antes de usar qualquer API (§7).

---

## 0. Visão do produto

**sqlboard** é uma plataforma web *SQL-first* para equipes montarem ferramentas internas e painéis a partir de queries prontas.

1. Um administrador cadastra **conexões** com bancos relacionais (PostgreSQL primeiro; depois MySQL, SQLite, SQL Server, Oracle).
2. Um editor cola ou escreve uma **query SQL**. Parâmetros na query (`:placa`, `{{data_inicio}}`) viram automaticamente **campos de entrada** tipados.
3. A ferramenta executa com segurança e devolve os dados com os **tipos das colunas**.
4. Com base nas colunas, o editor monta uma **tela** arrastando e soltando componentes (tabela, gráficos, KPIs, inputs, selects, datas, botões, texto) numa grade, configurando cada um num painel de propriedades.
5. A tela é **publicada** e a equipe usa em modo visualização, só preenchendo parâmetros e lendo/exportando resultados.

Design: **100% shadcn/ui**, conforme `docs/guides/UI.md`. Responsivo e acessível conforme `docs/guides/RESPONSIVENESS.md`.

### 0.1 Diferenciais (o que nos separa de Retool, Appsmith, Metabase, Redash)

- **SQL é o centro**, não um recurso escondido atrás de um editor visual.
- **Parâmetros detectados e tipados automaticamente**, com **cláusulas opcionais** `[[ AND status = :status ]]`: se o parâmetro vier vazio, o trecho inteiro some (ideia do Metabase, a mais pedida em ferramentas SQL).
- **"Gerar tela automática"**: a partir da query e dos tipos das colunas, propõe uma tela pronta (inputs para os parâmetros; data + número → gráfico de linha; categoria + número → barras; uma linha numérica → KPI; resto → tabela). O usuário só ajusta.
- **Visual bonito sem configurar nada** (shadcn), claro e escuro.
- **Leve e auto-hospedável**: um container da aplicação + um Postgres de metadados.

### 0.2 Ideias copiadas do estado da arte (de propósito)

| Ideia | Origem | Fase |
| --- | --- | --- |
| Query como recurso nomeado (`vendas.data`), execução automática ao mudar input ou manual | Retool | F3/F4 |
| Cláusulas opcionais `[[ ... ]]` | Metabase | F4 |
| Layout em grade `{x, y, w, h}` guardado em JSON com `schemaVersion` e migrações | Grafana | F3 |
| Bindings `{{ }}` **só em propriedades de componentes**, nunca dentro do SQL | Retool/Appsmith | F4 |
| Modos edição × visualização; rascunho × versão publicada; histórico | Retool/Grafana | F3/F4 |
| Export CSV/XLSX; cache de resultado com TTL | Redash/Metabase | F4 |

---

## 1. Protocolo de sessão [OBRIGATÓRIO]

### 1.1 Regras gerais

- **Trabalhe até o fim.** Não pare entre fases, não peça confirmação, não pergunte "posso continuar?". Tempo e custo não são restrição. Quando houver uma decisão razoável a tomar, tome-a, registre o motivo (`docs/learning/decision-*.md`) e siga. Só pare antes do fim diante de um bloqueio real do ambiente que impeça qualquer progresso; nesse caso, registre-o em `docs/AUDITORIA.md` e continue tudo o que não depende dele.
- **Commits direto na `main`.** Você está autorizado a commitar e dar push **na `main`**, sem criar branches nem pull requests, seguindo `docs/guides/COMMITS.md` (pt-BR, Conventional Commits, commits atômicos). Se a sessão estiver em outra branch, faça checkout da `main` atualizada antes de começar.
- **Pontos de salvamento.** Faça push a cada bloco coerente que passe nas verificações (no mínimo ao fim de cada entrega do roadmap), para que nada se perca se a sessão for interrompida. Nunca deixe a `main` quebrada: se o CI falhar após um push, a correção é a próxima prioridade.
- **Nunca** force-push, `reset --hard` em trabalho publicado, reescrita de histórico ou `--no-verify`.

### 1.2 Sequência de cada execução

1. **Contexto:** leia `AGENTS.md`, `LEARNING.md` (e só os tópicos relevantes de `docs/learning/`), `docs/ROADMAP.md`, `docs/AUDITORIA.md` e este arquivo. Rode `git log --oneline -30` e `git pull`.
2. **Diagnóstico do estado atual:** instale dependências, rode `scripts/dev-setup.sh` (se existir) e todas as verificações (§9). Anote o que está quebrado.
3. **Conserte o que está quebrado** antes de construir algo novo.
4. **Construção:** percorra o `docs/ROADMAP.md` em ordem (F0 → F6) e implemente **todas** as entregas não marcadas, uma fase após a outra, na mesma sessão. Para cada entrega: implemente (§3–§6, guias §8), teste, marque `[x]` no roadmap, commite e faça push.
5. **Auditoria** (sempre, mesmo quando a construção acabou de terminar nesta sessão): siga §1.3.
6. **Atualize a documentação viva:** `docs/ROADMAP.md` (status), `docs/AUDITORIA.md` (resumo desta passada), `AGENTS.md` (comandos reais verificados, com diretório e pré-requisitos), `LEARNING.md` + `docs/learning/` (só aprendizados duráveis, conforme `docs/guides/CONTEXT.md` Partes 3 e 5), `README.md`.
7. **Commit e push** finais na `main`; confirme que o CI ficou verde (`gh run list` / `gh run watch`, se disponível).
8. **Relatório final ao usuário** (§10).

### 1.3 Passada de auditoria

Trate o código existente com desconfiança: o objetivo é provar, com evidência, que **cada requisito** deste prompt e de cada critério de aceite do roadmap está realmente implementado e funcionando, e corrigir o que não estiver.

1. **Rastreabilidade:** percorra este prompt seção por seção (§0 a §9) e cada critério de aceite do roadmap. Para cada item, localize o código e o teste que o comprovam. Item sem implementação, incompleto ou sem teste → implemente/complete agora. Uma entrega marcada `[x]` que não se sustenta volta para `[ ]` até ser corrigida.
2. **Segurança:** revise §4 inteira contra o código: parâmetros sempre por bind, protocolo estendido, somente leitura, timeouts, limites, cancelamento, criptografia, senha nunca devolvida, permissões checadas no servidor em **todas** as rotas e ações, avaliador de bindings sem execução de código, segredos fora do repositório. Tente quebrar: escreva testes de ataque.
3. **Interface:** confira as regras obrigatórias de `docs/guides/UI.md` §1 e o perfil de validação de `docs/guides/RESPONSIVENESS.md` em todas as telas (320 px, tablet, desktop, teclado, foco, estados de carregando/vazio/erro/permissão, tema claro e escuro, `prefers-reduced-motion`).
4. **Testes:** procure caminhos sem teste, testes frágeis ou que não testam nada; reforce. Rode tudo de novo.
5. **Qualidade:** refatore duplicação, funções longas, nomes ruins, código morto, tipos `any`, tratamento de erro fraco. Refatoração não muda comportamento e vem em commit separado.
6. **Dependências:** atualize patches e minors seguros (especialmente correções de segurança do Next.js); majors só com migração completa e testes passando.
7. **Documentação:** README, `AGENTS.md` e roadmap batem com a realidade.
8. **Registro:** escreva em `docs/AUDITORIA.md` o resumo da passada (data, o que foi verificado, problemas encontrados e corrigidos, pendências reais). Pendências viram itens a resolver na mesma passada sempre que possível.

Repita 1–7 enquanto encontrar problemas relevantes e houver sessão disponível.

---

## 2. Escopo das fases

O detalhamento, critérios de aceite e status ficam em `docs/ROADMAP.md` (fonte única). Resumo:

| Fase | Entrega |
| --- | --- |
| F0 | Fundação: projeto Next.js + shadcn, qualidade (lint, typecheck, testes, CI), banco de metadados, autenticação e papéis, layout da aplicação |
| F1 | Conexões: cadastro com credencial criptografada, teste, introspecção de schema, permissão por conexão, banco de demonstração |
| F2 | Editor SQL + execução segura + parâmetros automáticos + resultado em tabela + auditoria |
| F3 | Construtor de telas: grade arrastável, componentes, painel de propriedades, salvar/abrir, modo visualização, gerar tela automática |
| F4 | Interatividade: várias queries e páginas, bindings, cláusulas opcionais, export, cache, versões/publicação, compartilhamento |
| F5 | Multi-banco: MySQL, SQLite, SQL Server (Oracle opcional) |
| F6 | Avançado: agendamento e envio, ações com escrita controlada, import/export JSON, servidor MCP |

---

## 3. Stack e arquitetura

### 3.1 Escolhas

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Aplicação | **Next.js (App Router, última estável — 16.x em out/2026)**, runtime Node, `output: "standalone"` | Front e back no mesmo projeto; é o ecossistema principal do shadcn; Route Handlers permitem streaming e `AbortSignal` para cancelar queries |
| Linguagem | **TypeScript** estrito | Se a 7.x quebrar alguma ferramenta (ESLint/plugins), use a 6.x e registre em `docs/learning/` |
| Gerenciador | **pnpm** | Rápido, lockfile determinístico |
| UI | **shadcn/ui** (base padrão atual: Base UI), **Tailwind CSS 4**, ícones `lucide-react` | Requisito do projeto; siga `docs/guides/UI.md` |
| Gráficos | **shadcn Chart** (Recharts por baixo) | Integrado aos tokens e ao tema |
| Tabelas | **TanStack Table** via Data Table do shadcn | Use a major que o guia/registry do shadcn usar no momento (o `UI.md` indica v9) |
| Dados no cliente | **TanStack Query** | Cache, estados de carregamento/erro, cancelamento |
| Editor SQL | **CodeMirror 6** (`@uiw/react-codemirror` + `@codemirror/lang-sql` com dialeto PostgreSQL e opção `schema` para autocomplete) | Leve (KB vs MB do Monaco) e autocomplete de tabelas/colunas pronto |
| Grade arrastável | **react-grid-layout v2** (hooks, `droppingItem` para arrastar da paleta, breakpoints) | Modelo `{x,y,w,h}` igual ao Grafana; maduro e ativo. Puck não faz grade redimensionável; Craft.js está parado |
| Estado do editor | **Zustand** com histórico (desfazer/refazer) | Simples, sem boilerplate |
| Validação | **Zod 4** | Schemas de tela, de componentes, de formulários e de API; o schema de cada componente também gera o painel de propriedades |
| Metadados | **PostgreSQL** + **Drizzle ORM** (linha estável 0.x; **não** use a 1.0 RC) com migrações versionadas | Mesmo dialeto em dev e produção; equipe desde o início |
| Autenticação | **Better Auth** (e-mail + senha; sessões no Postgres) | Recomendação atual para projetos novos (o Auth.js passou a ser mantido pelo time do Better Auth) |
| Execução SQL | **Drivers nativos** atrás de uma interface própria (`pg`, depois `mysql2`, `better-sqlite3`, `mssql`, `oracledb`) | Query builders (Kysely/knex) não ajudam com SQL do usuário, cursor, cancelamento e tipos |
| Testes | **Vitest** (unidade/integração com Postgres real), **Playwright** (fluxos no navegador, acessibilidade com `@axe-core/playwright`) | |
| Entrega | `Dockerfile` + `compose.yaml` (app + Postgres de metadados) | Auto-hospedagem simples para a equipe |

### 3.2 Estrutura (uma aplicação, módulos bem separados)

Um único projeto Next.js na raiz, sem monorepo: menos configuração e mais fácil para sessões de agente. Os módulos de domínio ficam isolados e testáveis sem React:

```text
src/
  app/                    # rotas (App Router): (auth), (app)/connections, (app)/queries, (app)/apps/[id]/edit, /view
  components/ui/          # componentes shadcn (gerados pela CLI; você é dono do código)
  components/             # componentes compartilhados do produto
  features/               # telas e lógica de UI por área: connections, query-editor, builder, viewer, admin
  server/
    db/                   # Drizzle: schema, migrações, cliente dos metadados
    auth/                 # Better Auth
    datasources/          # interface DataSourceAdapter + adapters (postgres, mysql, ...)
    execution/            # orquestra execução: permissão, auditoria, cache, limites
    crypto/               # criptografia de credenciais
  lib/
    sql-params/           # tokenizador e compilador de parâmetros (puro, sem dependências de banco)
    app-schema/           # schema Zod do documento de tela + migrações de schemaVersion
    widgets/              # registro de componentes: schema de props, sugestão por tipo de coluna
tests/ e2e/               # Playwright
```

Se a CLI do Next/shadcn gerar outra convenção (ex.: sem `src/`), siga a convenção gerada e ajuste esta árvore no `AGENTS.md`.

### 3.3 Interface de fonte de dados

```ts
interface DataSourceAdapter {
  testConnection(): Promise<void>
  introspect(): Promise<SchemaInfo>                 // schemas → tabelas → colunas (tipo, nulo, comentário)
  execute(sql: CompiledQuery, opts: ExecOptions): Promise<QueryResult> // limites, timeout, AbortSignal
  cancel(handle: ExecutionHandle): Promise<void>
  mapType(native: unknown): ColumnKind            // number | integer | decimal | text | date | datetime | boolean | json | unknown
  placeholderStyle: "dollar" | "question" | "at" | "colon" // $1 | ? | @p1 | :1
}
```

`QueryResult` traz `columns` (nome, `ColumnKind`, tipo nativo), `rows`, `rowCount`, `truncated`, `durationMs`.

---

## 4. Parâmetros e execução segura [OBRIGATÓRIO]

O sqlboard executa SQL escrito por pessoas contra bancos reais. Segurança aqui não é opcional.

### 4.1 Parâmetros

- Sintaxes aceitas: `:nome` e `{{nome}}` (normalizadas para a mesma coisa). Nomes: `[a-zA-Z_][a-zA-Z0-9_]*`.
- **Tokenizador próprio** em `src/lib/sql-params`, puro e com bateria grande de testes. Ele deve ignorar: strings `'...'` (com `''` escapado), identificadores `"..."`, comentários `--` e `/* */`, *dollar-quoting* `$$...$$` e `$tag$...$tag$`, o cast `::tipo`, e `:=`. Libs prontas (`yesql`, `named-placeholders` etc.) estão velhas ou fazem monkeypatch no driver; não use.
- Saída: SQL com placeholders do dialeto (`$1` no Postgres, `?` no MySQL/SQLite, `@p1` no SQL Server, `:1` no Oracle) + array de valores na ordem. **Valores nunca são concatenados no texto do SQL.** O mesmo parâmetro usado duas vezes reutiliza o placeholder quando o dialeto permite.
- Cláusulas opcionais `[[ ... ]]` (F4): se algum parâmetro dentro do trecho estiver vazio/nulo, o trecho é removido antes da compilação.
- Tipos de parâmetro: `text`, `number`, `integer`, `date`, `datetime`, `boolean`, `list` (opções fixas ou vindas de outra query), `multi` (lista de valores → `= ANY($1)` no Postgres; expansão `IN (?, ?, ...)` nos demais). Tipo inicial inferido (nome sugere data, uso em comparação etc.), sempre editável pelo usuário.

### 4.2 Execução (PostgreSQL; adapte o equivalente nos outros bancos)

1. Use **sempre o protocolo estendido** (prepare/bind), inclusive sem parâmetros: nele o Postgres **recusa mais de um comando por chamada**, o que bloqueia `...; DROP TABLE ...`. No `pg` isso exige forçar o modo (opção `queryMode: 'extended'` existente no código do `pg` 8.x, mas não documentada): **escreva um teste que prove** que dois comandos são rejeitados; se a opção não existir na versão instalada, encontre outra forma e registre em `docs/learning/`.
2. Execute dentro de `BEGIN READ ONLY` → `SET LOCAL statement_timeout` e `lock_timeout` → query → `ROLLBACK`.
3. **Limite de linhas** configurável (padrão 5.000; máximo por conexão): leia com cursor (`pg-cursor`) até N+1 para saber se truncou. Não embrulhe a query do usuário em `SELECT * FROM (...) LIMIT`.
4. **Cancelamento**: guarde o PID do backend e cancele com `pg_cancel_backend(pid)` por outra conexão, ligado ao `AbortSignal` da requisição e a um botão "Cancelar" na interface.
5. **Tipos**: use `fields[i].dataTypeID` (OID) para mapear `ColumnKind`. `int8` e `numeric` chegam como string: preserve a precisão (não converta cegamente para `number`), formate na interface.
6. **Pool por conexão** com limite baixo de clientes e encerramento ocioso.
7. **Documente para o usuário** (na tela de cadastro de conexão e no README): a defesa principal é um **usuário de banco só com permissão de SELECT** (de preferência com `default_transaction_read_only=on`). READ ONLY sozinho não basta (ex.: `dblink`).

### 4.3 Credenciais e segredos

- Senhas de conexão criptografadas com **AES-256-GCM** (`node:crypto`), IV aleatório de 12 bytes por segredo, *auth tag* guardado junto, `keyVersion` para rotação. Chave de 32 bytes em variável de ambiente (`SQLBOARD_ENCRYPTION_KEY`).
- A senha **nunca volta** para o navegador; o formulário de edição mostra "senha definida" e só envia se for trocada.
- Nada de segredo no repositório: só `.env.example` com valores falsos e instruções para gerar chaves.

### 4.4 Equipe, permissões e auditoria

- Papéis globais: **admin** (usuários, conexões, tudo), **editor** (cria queries e telas nas conexões que pode usar), **viewer** (usa telas publicadas compartilhadas com ele). O primeiro usuário cadastrado vira admin; depois, cadastro só por convite/admin.
- Permissão **por conexão** (quem pode usar) e **por tela** (quem vê/edita).
- Toda checagem de permissão é feita **no servidor**, em toda rota e ação; esconder botão não é segurança.
- **Auditoria** de execuções: usuário, tela/query, hash do SQL, parâmetros (com opção de mascarar), duração, linhas, erro. Tela de consulta da auditoria para admin.

---

## 5. Documento de tela (formato persistido)

Um JSON por aplicação, validado por Zod e versionado:

```jsonc
{
  "schemaVersion": 1,
  "app": { "id": "…", "name": "Frota por município",
           "description": "Acompanhar a frota por tipo de veículo em cada município, para o relatório mensal da equipe.",
           "tags": ["frota", "mensal"] },
  "queries": [
    { "id": "q1", "name": "frota", "connectionId": "…", "sql": "select … where uf = :uf",
      "params": [{ "name": "uf", "type": "text", "default": "CE", "required": true }],
      "runMode": "auto" }            // auto: roda ao mudar parâmetro; manual: botão
  ],
  "pages": [
    { "id": "p1", "name": "Visão geral", "layout": { "cols": 12, "rowHeight": 40 },
      "widgets": [
        { "id": "w1", "type": "bar-chart", "grid": { "x": 0, "y": 0, "w": 6, "h": 8 },
          "props": { "title": "Veículos por tipo", "x": "tipo", "y": ["total"] },
          "bindings": { "data": "{{frota.data}}" } }
      ] }
  ]
}
```

- `type` é um `discriminatedUnion`; cada tipo de widget tem seu schema de `props` (que também gera o painel de propriedades).
- Mudou o formato? Incremente `schemaVersion` e escreva a migração `vN → vN+1`, aplicada ao carregar (com teste).
- Persistência: tabela de apps com **rascunho** + tabela `app_versions` com snapshots imutáveis; "publicar" aponta a versão ativa. Metadados da tela (nome, descrição, tags, dono, datas de criação/alteração/publicação) ficam em colunas da tabela de apps para listagem e busca, além de estarem no documento.
- Queries da tela: criadas direto no editor da tela **ou** trazidas da biblioteca de queries salvas (F2). Ao trazer, a query é **copiada** para dentro da tela (com referência à origem), para que versões publicadas não mudem quando alguém editar a query da biblioteca.

### 5.0 Biblioteca de telas

Cada tela é um item com identidade própria; o usuário cria quantas quiser, cada uma com suas queries.

- **Nome** (obrigatório, único por dono) e **descrição/finalidade** ("por que esta tela existe": para que serve, quem usa, de onde vêm os dados). A descrição é pedida já no diálogo de criação (opcional, mas incentivada com texto de ajuda), editável depois e exibida no modo visualização (no topo, recolhível) e nos cards da lista.
- **Tags** livres para organizar.
- **Lista de telas**: cards ou tabela com nome, descrição resumida, tags, dono, última alteração e status (rascunho/publicada); busca por nome, descrição e tags; filtros por tag e "minhas/compartilhadas comigo"; estado vazio com ação "Criar primeira tela".
- Ações: criar, abrir, editar, visualizar, renomear/editar descrição, duplicar, excluir (com `AlertDialog`).
- O mesmo vale para a biblioteca de queries (F2): nome, descrição e tags, com busca.

### 5.1 Componentes (widgets)

MVP (F3): tabela (ordenação, paginação, formatação por tipo, busca), gráfico de barras, linha, área, pizza/rosca, card de KPI (valor, rótulo, comparação opcional), texto/Markdown, campo texto, número, data, intervalo de datas, select, multi-select, switch, botão (executar query, exportar, navegar). Depois: abas, container, imagem, mapa.

### 5.2 Experiência do construtor

- Três áreas: **paleta** (esquerda), **grade** de 12 colunas (centro), **propriedades** (direita). Em telas estreitas, paleta e propriedades viram `Sheet`/`Drawer`.
- Barra superior: nome, alternar **Editar/Visualizar**, desfazer/refazer, salvar (com autosave de rascunho), publicar.
- **Alternativa sem arrastar** para tudo que se faz arrastando (acessibilidade, WCAG 2.5.7): adicionar pela paleta com clique/teclado, mover e redimensionar por campos numéricos e atalhos.
- Ao escolher a query, o painel lista as **colunas com o tipo** e sugere componentes; botão **"Gerar tela automática"**.
- Estados claros: carregando (Skeleton), vazio (Empty), erro da query (mensagem do banco traduzida + SQL destacado), truncado ("mostrando 5.000 de mais linhas").

### 5.3 Modo visualização

- Responsivo: no celular os widgets empilham em uma coluna na ordem de leitura (`y`, depois `x`), usando os breakpoints do react-grid-layout.
- Parâmetros no topo (ou na lateral em telas largas); "Executar" quando `runMode` for manual.
- URL compartilhável que guarda os parâmetros (deep link).

---

## 6. Ambiente, dados de demonstração e testes

- **Ambiente na nuvem (Claude Code na web):** Ubuntu com Node 22, pnpm, Docker e PostgreSQL 16 pré-instalados (o Postgres vem **parado**: `service postgresql start`). Rede padrão libera npm e GitHub. Confirme o que existe antes de assumir; registre em `docs/learning/` o que descobrir (ex.: se o Playwright consegue baixar o Chromium).
- **Script idempotente** `scripts/dev-setup.sh`: sobe o Postgres local (ou via `compose.yaml` com Docker), cria o banco de metadados, o banco de demonstração e um usuário somente leitura para ele, roda migrações e seed. Na F0, avalie um hook `SessionStart` em `.claude/settings.json` restrito a `CLAUDE_CODE_REMOTE=true` para instalar dependências e rodar esse script.
- **Banco de demonstração** (`sqlboard_demo`): dados **fictícios**, genéricos e realistas (ex.: uma loja com clientes, produtos, pedidos e itens ao longo de 2 anos, com datas, valores decimais, categorias, nulos e textos longos), para desenvolver, testar e demonstrar. **Nunca** use dados reais ou de empresas.
- **Testes obrigatórios:** tokenizador de parâmetros (casos de borda de §4.1), compilador por dialeto, execução segura (múltiplos comandos rejeitados, READ ONLY, timeout, truncamento, cancelamento) contra Postgres real, criptografia, permissões no servidor, migrações de `schemaVersion`, e e2e dos fluxos principais de cada fase com verificação de acessibilidade.
- **CI** (GitHub Actions, criado na F0): instala, lint, typecheck, testes com serviço Postgres, build e e2e. Mantenha verde.

---

## 7. Versões e documentação [OBRIGATÓRIO]

- Use a última versão **estável** de cada pacote na hora da instalação; confira no npm. Não instale RC/beta sem motivo registrado.
- Next.js: antes de escrever código específico do framework, leia a documentação instalada em `node_modules/next/dist/docs/` (as versões novas podem diferir do que você lembra). Mantenha o Next atualizado em patches de segurança.
- shadcn: rode `npx shadcn@latest docs <componente>` e leia o arquivo instalado antes de usar a API (Base UI usa `render`, não `asChild`).
- Não invente APIs, opções ou comandos. Na dúvida, leia o código da dependência em `node_modules`.

---

## 8. Guias do repositório

Leia a seção relevante para a tarefa, não o guia inteiro de uma vez:

| Guia | Quando |
| --- | --- |
| `docs/guides/UI.md` | Qualquer tela ou componente: §1 sempre; a seção do componente usado |
| `docs/guides/RESPONSIVENESS.md` | Toda interface: "Validation scope" para escolher o perfil de validação; F0/F3 usam o perfil de nova aplicação/fundação. PWA **não** é requisito do produto: marque como não aplicável |
| `docs/guides/CONTEXT.md` | Ao atualizar `AGENTS.md`, `CLAUDE.md`, `LEARNING.md`, `docs/learning/` |
| `docs/guides/COMMITS.md` | Antes de cada commit |

Idioma: código, identificadores e `AGENTS.md`/`CLAUDE.md` em inglês; **interface do produto, commits, README, roadmap e aprendizados em pt-BR** com acentuação correta.

---

## 9. Definição de pronto (de cada fase e de cada passada)

- [ ] Critérios de aceite das fases no `docs/ROADMAP.md` atendidos.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passando (comandos reais registrados no `AGENTS.md`).
- [ ] E2E dos fluxos novos passando; verificação de acessibilidade sem violações sérias.
- [ ] Telas novas verificadas em larguras de celular (320–390 px), tablet e desktop, teclado e foco, estados de carregando/vazio/erro/permissão.
- [ ] Nenhum segredo commitado; `.env.example` atualizado.
- [ ] Roadmap, `docs/AUDITORIA.md`, `AGENTS.md`, `LEARNING.md` e README atualizados.
- [ ] Commits atômicos em pt-BR, push na `main`, CI verde.
- Se algo não pôde ser verificado por limitação do ambiente, **diga qual verificação ficou pendente e por quê**; não marque como passou.

---

## 10. Relatório final ao usuário

O usuário é desenvolvedor (Java, Python, Rails), mas o ecossistema React/Next.js é novo para ele. Escreva em **pt-BR**, curto e didático:

1. **O que foi feito** nesta passada (fases construídas, problemas da auditoria encontrados e corrigidos).
2. **Por que** das decisões relevantes (o que é, por que assim, impacto) — explique em uma frase termos que não sejam óbvios.
3. **Como foi validado** (comandos e resultados reais; o que ficou pendente).
4. **O que ele precisa decidir ou fazer** (ex.: configurar variável de ambiente), se houver.
5. **Situação geral:** fases concluídas, pendências reais e o que a próxima passada deve priorizar.

Última linha: `LEARNING: <entradas criadas/atualizadas ou nenhum aprendizado durável nesta tarefa>`.
