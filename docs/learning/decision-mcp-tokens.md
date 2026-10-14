---
name: MCP e tokens de API com os acessos de quem criou, sem publicar
description: Agentes usam tokens pessoais (hash no banco, validade, revogáveis) e só criam/editam rascunhos; publicar, administrar e gerenciar conexões, ações e tokens exige a sessão do navegador.
type: project
category: decision
date: 2026-10-14
---
O servidor MCP (`/api/mcp`, Streamable HTTP sem estado, respostas JSON) chama os mesmos services da API como o dono do token. Assim, papel, acesso a conexões e permissões de tela valem igual para pessoas e agentes, sem uma segunda camada de regras.

**Problema/Contexto:** F6 pede agentes criando/editando telas; um token vazado não pode virar porta de administração.
**Por que importa:** limita o estrago de um token exposto e mantém a publicação como decisão humana.
**Como aplicar:** novas rotas de administração usam `route(..., { allowToken: false })` (`server/http.ts`); ferramentas MCP novas chamam services existentes, nunca o banco direto; não exponha "publicar" no MCP sem rever esta decisão.
**Evidência:** `tests/integration/mcp.test.ts`, `tests/e2e/tokens-sync.e2e.ts` (token não acessa `/api/tokens`), auditoria de 2026-10-14.
