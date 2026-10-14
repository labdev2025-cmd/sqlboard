---
name: TypeScript 7 e ESLint 10 ainda incompatíveis com o lint do Next
description: typescript-eslint 8.x exige TypeScript < 6.1 e eslint-plugin-react aceita só ESLint ≤ 9; o projeto fixa TS 6.0.x e ESLint 9.
type: project
category: gotcha
date: 2026-10-14
---
Em 2026-10-14 o `latest` do npm é TypeScript 7.0.2 e ESLint 10, mas `eslint-config-next` 16.4 depende de `typescript-eslint` 8.71 (peer `typescript >=4.8.4 <6.1.0`) e de `eslint-plugin-react` 7.37 (peer `eslint ^9.7`).

**Problema/Contexto:** instalar as versões mais novas quebraria `pnpm lint`.
**Por que importa:** o `PROMPT.md` pede a última estável, com exceção registrada quando uma ferramenta quebra.
**Como aplicar:** mantenha `typescript@~6.0` e `eslint@9` até as peers aceitarem as majors novas (`npm view typescript-eslint peerDependencies`). Reavalie em cada passada de auditoria.
**Evidência:** `npm view typescript-eslint peerDependencies`, `npm view eslint-plugin-react peerDependencies` em 2026-10-14; `pnpm lint` verde com TS 6.0.3.
