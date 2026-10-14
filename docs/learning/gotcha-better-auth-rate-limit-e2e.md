---
name: Rate limit do Better Auth derruba logins seguidos no e2e
description: Em produção o Better Auth limita /sign-in; vários logins do mesmo IP no e2e viram 429. O e2e usa SQLBOARD_AUTH_RATE_LIMIT=off.
type: project
category: gotcha
date: 2026-10-14
---
O Better Auth ativa rate limit fora de desenvolvimento. Os testes e2e rodam contra o build de produção e fazem muitos logins do mesmo endereço; o quarto login seguido recebia 429 e o formulário mostrava "senha incorreta".

**Problema/Contexto:** falha intermitente no teste de login depois do setup.
**Por que importa:** o sintoma parece credencial errada; a causa é o limitador.
**Como aplicar:** `server/auth/auth.ts` lê `SQLBOARD_AUTH_RATE_LIMIT` (`off` só no e2e, em `tests/e2e/support/env.ts`); o formulário trata 429 com mensagem própria. Não desligue em produção.
**Evidência:** `tests/e2e/auth.e2e.ts` "login, senha errada e logout" falhava antes e passa depois da mudança (2026-10-14).
