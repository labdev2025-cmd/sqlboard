---
name: Construtor acompanha mudanças externas por consulta periódica
description: O construtor aberto consulta o rascunho a cada 3 s quando não há edição pendente e aplica a versão nova como um passo de desfazer; a compactação da grade não conta como edição.
type: project
category: decision
date: 2026-10-14
---
Para a pessoa ver a IA trabalhar (ferramentas MCP salvando o rascunho), o construtor faz `GET /api/apps/:id` a cada 3 s com a aba visível, sem salvamento em andamento e sem edição local pendente. Se `updatedAt` mudou, troca o documento por `replaceExternal` (um passo de desfazer) e avisa com toast.

**Problema/Contexto:** pedido do usuário de "ver a IA fazendo"; WebSocket/SSE exigiria estado por processo e não funciona bem com várias réplicas.
**Por que importa:** com edição local pendente, a mudança externa não é aplicada; o salvamento local recebe 409 e avisa (nada é sobrescrito em silêncio).
**Como aplicar:** mudanças que não vêm da pessoa (compactação da grade feita pelo react-grid-layout ao renderizar) não podem marcar o rascunho como sujo quando ele estava sincronizado; senão o salvamento automático colide com a próxima mudança do agente (falha vista no e2e `ai-connect.e2e.ts`). Ver `onLayout` em `features/builder/builder.tsx`.
**Evidência:** `tests/e2e/ai-connect.e2e.ts` ("o construtor mostra ao vivo o que a IA faz na tela").
