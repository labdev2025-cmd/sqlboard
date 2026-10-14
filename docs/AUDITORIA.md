# Auditoria do sqlboard

Resumo de cada passada de execução do `PROMPT.md` (§1.3). A passada mais recente fica no topo. Registre só fatos verificados: data, o que foi conferido, problemas encontrados e corrigidos, pendências reais. Sem transcrição do trabalho.

## Pendências abertas

- **Navegadores além do Chromium e aparelhos reais:** o ambiente só tem Chromium (Playwright). Firefox, Safari/WebKit e telas de toque reais não foram testados.
- **SQL Server só no CI:** não há como instalar o SQL Server no sandbox (proxy bloqueia o pacote, sem Docker). O adapter é validado pelo job do CI com SQL Server 2022.
- **Docker só no CI:** a imagem é construída e testada (saúde, migrações, login) pelo job `docker` do CI; não há Docker local.
- **Oracle:** não implementado (opcional na F5; sem como testar).
- **Vulnerabilidades em dependências sem correção aplicável** (`pnpm audit --prod`, 2026-10-14): `uuid < 11.1.1` via `exceljs` (afeta só `v3/v5/v6` com `buf`, que o exceljs não usa) e `esbuild <= 0.24.2` via `better-auth > drizzle-kit` (afeta só o servidor de desenvolvimento do esbuild, que não roda em produção). Reavaliar quando os pacotes atualizarem.
- **Várias réplicas:** cache de resultados, cancelamento por botão e token de prévia das ações são por processo (documentado em `docs/DEPLOY.md` §10; use afinidade de sessão).

## Passadas

### 2026-10-14 — construção de F5 e F6 e primeira passada completa de auditoria

**Construído:** F5 (MySQL/MariaDB, SQLite e SQL Server, com testes por banco e tabela de capacidades no README) e F6 (agendamentos por e-mail em CSV/XLSX/PDF, ações de escrita controlada, import/export de telas em JSON com sincronização para git, tokens de API e servidor MCP, geração de tela por IA, imagem Docker endurecida com job de CI e guia de deploy).

**Como a auditoria foi feita:** três revisões independentes (segurança de todas as rotas e adapters; rastreabilidade de cada requisito do `PROMPT.md` §0–§6 e de cada critério do roadmap até código e teste; regras obrigatórias de `docs/guides/UI.md` §1 e `RESPONSIVENESS.md`), seguidas de correção e de testes novos para cada achado.

**Segurança — encontrado e corrigido:**
- SQL Server executava lotes com mais de um comando sem `;` (ex.: `SELECT 1 COMMIT UPDATE …`), o que permitia gravar. Palavras que iniciam outro comando são recusadas e o adapter confere `@@TRANCOUNT`.
- Duplicar uma tela só com permissão de leitura copiava o rascunho e permitia publicar e rodar queries numa conexão sem acesso. Agora copia a versão publicada e exige acesso às conexões.
- Leitores recebiam o SQL e a conexão de cada query; agora o documento enviado ao navegador vem sem eles.
- Editor com compartilhamento de edição podia mudar parâmetros/opções de uma query sem acesso à conexão; qualquer mudança na query passa a exigir acesso.
- Limite de tentativas de login era só em memória e por IP; passou a ficar no banco, por IP e por conta, com cabeçalho de IP configurável. Corrida no primeiro cadastro (dois administradores) eliminada.
- Domínios permitidos de e-mail passaram a valer também a cada envio.
- Riscos menores: `INTO OUTFILE`/`LOAD_FILE` no MySQL, locks e variáveis de sessão vazando pelo pool, UPDATE com WHERE só em subquery, link simbólico saindo da pasta do SQLite, origem da auditoria informada pelo cliente, parâmetros de ações sem máscara, tokens com poder de administrar conexões, segredos de exemplo aceitos em produção e listas de parâmetros sem limite. Todos corrigidos com testes.
- Corrida real encontrada pelo CI: o `KILL QUERY` disparado ao truncar no MySQL podia interromper a query seguinte de outra pessoa no mesmo pool; cancelamentos agora são aguardados antes de devolver a conexão (também no PostgreSQL).

**Funcional — encontrado e corrigido:** aviso de truncamento ausente nos componentes; erro de query no construtor sem o SQL; comparação "Melhorar com IA" ignorava a ordem das linhas mesmo com `ORDER BY`; `IN (:lista)` falhava no PostgreSQL (agora vira `= ANY`); compactação da grade virava passo de desfazer.

**Interface — encontrado e corrigido:** diálogos longos sem rolagem em telas baixas; filtro "Compartilhadas comigo" estourando 320 px; campos sem `aria-invalid` nos erros do servidor; listas de escolha vazias sem explicação; "copiado" exibido mesmo quando a cópia falhava; sem páginas de erro/não encontrada/carregando em português; alvos de toque pequenos; contraste falso-positivo do axe no CI durante animações (os testes agora esperam as animações).

**Testes adicionados nesta passada:** integração por banco (MySQL, SQLite, SQL Server no CI), agendamentos, ações de escrita (ataques de bind, limite de linhas, token de prévia de uso único, máscara), import/export, MCP, tokens, limite de login, rotação de chave, nomes únicos, filtros e cópia da biblioteca; E2E de agendamentos, ações, tokens/MCP/sincronização git, geração por IA, todos os componentes do MVP e varredura de responsividade/acessibilidade (320/768/1280 px, claro e escuro) em todas as telas e no construtor em tela estreita.

**Dependências:** Next 16.4.1, React 19.3.1, Recharts 3.10.1 e patches. TypeScript 6 e ESLint 9 continuam fixados (`docs/learning/gotcha-versoes-typescript-eslint.md`).

**Validação final:** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (132 testes; 6 de SQL Server pulados localmente e executados no CI), `pnpm build` e `pnpm test:e2e` (44 testes) passando localmente; CI verde com os jobs `ci` (Postgres, MySQL 8.4 e SQL Server 2022) e `docker`.
