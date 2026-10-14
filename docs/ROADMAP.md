# Roadmap do sqlboard

Fonte única das fases, critérios de aceite e status. Protocolo de execução: `PROMPT.md` §1 (todas as fases na mesma sessão, depois auditoria).
Status possíveis: `pendente`, `em andamento`, `concluída`. Marque cada entrega com `[x]` só quando implementada **e** testada; a auditoria desmarca o que não se sustentar. Ao concluir uma fase, registre data e pendências reais.

---

## F0 — Fundação

**Status:** concluída em 2026-10-14. Pendência real: validação em navegadores além do Chromium e em aparelhos reais (ambiente só tem Chromium).

Entregas:
- [x] Projeto Next.js (App Router, TypeScript estrito, pnpm) com shadcn/ui inicializado (`init -t next`), tema claro/escuro, fonte e tokens definidos.
- [x] Qualidade: ESLint, Prettier (ou o formatador que a CLI do Next/shadcn trouxer), `typecheck`, Vitest, Playwright + axe; scripts no `package.json`.
- [x] CI no GitHub Actions: install, lint, typecheck, testes com serviço Postgres, build, e2e.
- [x] Banco de metadados PostgreSQL com Drizzle e migrações; `compose.yaml` para dev; `scripts/dev-setup.sh` idempotente; `.env.example`.
- [x] Better Auth (e-mail + senha): primeiro usuário vira admin; depois, cadastro só por admin/convite. Papéis `admin`, `editor`, `viewer` verificados no servidor.
- [x] Layout da aplicação (Sidebar do shadcn, responsiva) com áreas vazias: Conexões, Queries, Apps, Administração; página de login; estados vazios.
- [x] `AGENTS.md` com comandos reais verificados; README com "como rodar".

Critérios de aceite:
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passam; CI verde no push.
- E2E: cadastro do primeiro admin, login, logout, viewer não acessa área de admin (bloqueado no servidor, não só escondido).
- Layout verificado em 320 px, tablet e desktop; navegação por teclado; tema claro/escuro.

---

## F1 — Conexões

**Status:** concluída em 2026-10-14.

Entregas:
- [x] CRUD de conexões PostgreSQL (admin): host, porta, banco, usuário, senha, SSL, timeout e limite de linhas padrão.
- [x] Senha criptografada com AES-256-GCM (`SQLBOARD_ENCRYPTION_KEY`), nunca devolvida ao navegador.
- [x] "Testar conexão" com mensagem de erro traduzida.
- [x] Introspecção de schema (schemas, tabelas, views, colunas, tipos, comentários, chaves primárias/estrangeiras e índices) com cache por conexão e botão de atualizar; navegador de schema.
- [x] Permissão por conexão (quais usuários/editores podem usar).
- [x] Banco de demonstração `sqlboard_demo` com dados fictícios e usuário somente leitura; conexão de demo criada pelo seed em dev.
- [x] Aviso na tela de cadastro recomendando usuário de banco só com SELECT.

Critérios de aceite:
- Testes: criptografia (ida e volta, IV único, adulteração detectada), permissões no servidor, introspecção contra Postgres real.
- E2E: admin cadastra, testa e edita conexão; editor sem permissão não vê nem usa a conexão.

---

## F2 — Editor SQL, execução segura e parâmetros

**Status:** concluída em 2026-10-14.

Entregas:
- [x] Biblioteca de queries salvas (nome, descrição, tags, conexão, SQL, parâmetros), com busca.
- [x] Editor CodeMirror 6 com dialeto PostgreSQL, autocomplete do schema introspectado, atalho para executar, tema claro/escuro.
- [x] Tokenizador/compilador de parâmetros `:nome` e `{{nome}}` (`src/lib/sql-params`), detecção automática e formulário de parâmetros tipados.
- [x] Execução segura conforme `PROMPT.md` §4.2: protocolo estendido, READ ONLY, timeouts, cursor com limite e indicação de truncado, cancelamento.
- [x] Resultado em Data Table (tipos formatados, ordenação, paginação, busca, colunas redimensionáveis) + tempo de execução e quantidade de linhas.
- [x] Auditoria das execuções e tela de auditoria para admin.
- [x] "Melhorar com IA" (`PROMPT.md` §4.5): copiar prompt pronto (instruções + contexto opcional + query) para a área de transferência ou .txt; colar a resposta, extrair o SQL, validar parâmetros, ver diff, comparar execução das duas versões e aplicar.
- [x] Histórico de versões da query salva (restaurar versão anterior).

Critérios de aceite:
- Testes do tokenizador cobrindo strings, identificadores, comentários, dollar-quoting, `::`, `:=`, parâmetro repetido.
- Testes contra Postgres real: dois comandos rejeitados, escrita rejeitada, timeout, truncamento, cancelamento, precisão de `numeric`/`int8`.
- E2E: escrever query com parâmetro, preencher, executar, ver resultado; cancelar query lenta (`pg_sleep`).
- Testes do prompt de IA: contém instruções, contexto selecionado e a query; nunca contém linhas de dados nem credenciais. E2E: copiar prompt, colar resposta com bloco ```sql```, ver diff, comparar (resultados idênticos detectados) e aplicar.

---

## F3 — Construtor de telas

**Status:** pendente

Entregas:
- [ ] Schema Zod do documento de tela (`schemaVersion` 1) e registro de widgets (`PROMPT.md` §5).
- [ ] Editor: paleta, grade de 12 colunas (react-grid-layout v2) com arrastar/redimensionar, painel de propriedades gerado do schema, desfazer/refazer, autosave de rascunho, alternativa sem arrastar (teclado e campos numéricos).
- [ ] Widgets do MVP (`PROMPT.md` §5.1) ligados a uma query da tela e aos seus parâmetros.
- [ ] Sugestão de widget pelo tipo das colunas e botão "Gerar tela automática".
- [ ] Modo visualização responsivo (empilha no celular), parâmetros no topo, URL com parâmetros.
- [ ] Biblioteca de telas (`PROMPT.md` §5.0): cada tela com nome, descrição/finalidade e tags; lista com busca e filtros; criar, editar dados, duplicar, excluir (com confirmação). Descrição exibida no modo visualização.
- [ ] Usar query da biblioteca numa tela (cópia com referência à origem) ou criar query direto na tela.

Critérios de aceite:
- Testes: validação do schema, sugestão por tipo de coluna, geração automática.
- E2E: criar duas telas com nomes, descrições e queries diferentes, encontrá-las pela busca; criar app a partir de query, gerar tela automática, mover/redimensionar widget (com mouse e com teclado), salvar, reabrir, visualizar em celular e desktop.
- Perfil "nova aplicação/fundação" do `RESPONSIVENESS.md` aplicado ao editor e ao modo visualização.

---

## F4 — Interatividade, versões e compartilhamento

**Status:** pendente

Entregas:
- [ ] Várias queries e várias páginas por app; `runMode` automático/manual.
- [ ] Bindings `{{query.data}}`, `{{widget.value}}` em propriedades (avaliador seguro e restrito, sem `eval`); clique numa linha/barra alimenta parâmetro de outra query.
- [ ] Cláusulas opcionais `[[ ... ]]`.
- [ ] Parâmetro `list`/`multi` com opções vindas de outra query.
- [ ] Export CSV e XLSX do resultado (respeitando permissões e limites).
- [ ] Cache de resultado com TTL por query.
- [ ] Versões: publicar rascunho, histórico, restaurar; compartilhar app com usuários (ver/editar).
- [ ] Migração de `schemaVersion` se o formato mudar (com teste).

Critérios de aceite:
- Testes do avaliador de bindings (inclusive tentativas de execução de código) e das cláusulas opcionais.
- E2E: filtro encadeado entre widgets, publicar e visualizar versão publicada como viewer, export.

---

## F5 — Multi-banco

**Status:** pendente

Entregas:
- [ ] Adapters MySQL/MariaDB (`mysql2`), SQLite (`better-sqlite3`), SQL Server (`mssql`); Oracle (`oracledb`) se o ambiente permitir testar.
- [ ] Dialeto correto no editor e no compilador de parâmetros; mapeamento de tipos; somente leitura e timeout equivalentes em cada banco (documentar limitações de cada um).

Critérios de aceite:
- Testes de integração por banco (containers via Docker quando disponível); tabela de capacidades por banco no README.

---

## F6 — Avançado

**Status:** pendente

Entregas (implemente na ordem; cada uma com as mesmas exigências de segurança e testes das fases anteriores):
- [ ] Agendamento de queries/telas com envio por e-mail (CSV/PDF).
- [ ] Ações com escrita controlada: formulários com INSERT/UPDATE explícitos, conexão separada de escrita, prévia, confirmação, transação e auditoria.
- [ ] Import/export de apps em JSON (e versionamento em git).
- [ ] Servidor MCP para agentes criarem/editarem telas; geração de tela por IA.
- [ ] Dockerfile de produção e guia de deploy.
