---
name: error.tsx do Next 16.4 recebe retry, não reset
description: Na versão instalada, o error boundary do App Router recebe a prop retry() para tentar de novo; exemplos antigos usam reset().
type: project
category: gotcha
date: 2026-10-14
---
A documentação instalada (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`) mostra `({ error, retry })`. Código escrito de memória com `reset` compila só se a tipagem for frouxa e não recupera a página.

**Problema/Contexto:** páginas de erro do grupo `(app)` (auditoria de 2026-10-14).
**Por que importa:** o botão "Tentar de novo" ficaria sem efeito.
**Como aplicar:** antes de usar arquivos especiais do App Router, leia o `.md` correspondente na documentação instalada; ver `app/(app)/error.tsx`.
**Evidência:** documentação do Next 16.4.1 instalada no projeto.
