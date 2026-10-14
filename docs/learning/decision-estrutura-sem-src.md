---
name: Estrutura sem src/ e API em Route Handlers
description: O projeto segue a convenção do template next do shadcn (sem src/) e expõe os dados por Route Handlers JSON com checagem central de permissão.
type: project
category: decision
date: 2026-10-14
---
A árvore do `PROMPT.md` §3.2 usa `src/`, mas o template `next` do shadcn gera tudo na raiz; o próprio prompt manda seguir a convenção gerada. Os módulos ficam em `app/`, `components/`, `features/`, `server/` e `lib/` na raiz.

**Problema/Contexto:** escolha de estrutura e de como o cliente fala com o servidor (Server Actions × Route Handlers).
**Por que importa:** misturar convenções confunde sessões futuras e espalha checagens de permissão.
**Como aplicar:** dados e mutações passam por `app/api/**/route.ts` usando `route()` de `server/http.ts` (sessão, papel, erros em pt-BR); regras de permissão moram em `server/services/*`. Páginas são Server Components que só checam sessão/papel e renderizam a feature do cliente (TanStack Query). Route Handlers dão `request.signal` para cancelar queries.
**Evidência:** `components.json` (aliases `@/components`, `@/lib`), `server/http.ts`, `tests/e2e/auth.e2e.ts` (viewer recebe 403 na API e "Acesso negado" na página).
