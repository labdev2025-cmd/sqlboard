---
name: MCP e tokens de API com os acessos de quem criou, sem publicar
description: Agentes usam tokens pessoais (hash no banco, validade, revogáveis) e só criam/editam rascunhos e queries; publicar, compartilhar, excluir telas, agendar, rodar ações de escrita, administrar e gerenciar conexões e tokens exige a sessão do navegador.
type: project
category: decision
date: 2026-10-14
---
O servidor MCP (`/api/mcp`, Streamable HTTP sem estado, respostas JSON) chama os mesmos services da API como o dono do token. Assim, papel, acesso a conexões e permissões de tela valem igual para pessoas e agentes, sem uma segunda camada de regras.

**Problema/Contexto:** F6 pede agentes criando/editando telas; um token vazado não pode virar porta de administração.
**Por que importa:** limita o estrago de um token exposto e mantém a publicação como decisão humana.
**Como aplicar:** novas rotas de administração, publicação, compartilhamento, exclusão, agendamento ou escrita usam `route(..., { allowToken: false })` (`server/http.ts`) — o padrão de `route()` aceita token; tokens-scope é coberto por `tests/integration/token-scope.test.ts`; ferramentas MCP novas chamam services existentes, nunca o banco direto; não exponha "publicar" no MCP sem rever esta decisão.
**Evidência:** `tests/integration/mcp.test.ts`, `tests/integration/token-scope.test.ts`, `tests/e2e/tokens-sync.e2e.ts` (token não acessa `/api/tokens`), auditoria de 2026-10-14.

**Atualização (2026-10-14):** a auditoria achou publicação, compartilhamento, exclusão, agendamentos e ações de escrita aceitando token (um token vazado podia criar agendamento que continuava enviando e-mails após a revogação); essas rotas passaram a exigir a sessão. A tela **Conectar IA** (`/ai`) gera o token e a configuração de cada cliente; o servidor anuncia o fluxo em `instructions` e o texto vem de `lib/ai-connect` (o mesmo da skill).
