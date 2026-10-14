---
name: Registry do shadcn bloqueado no sandbox
description: ui.shadcn.com responde 403 no proxy da nuvem; o CLI funciona apontando REGISTRY_URL para o site do shadcn rodando localmente a partir do GitHub.
type: project
category: gotcha
date: 2026-10-14
---
No ambiente de nuvem do Claude Code, `ui.shadcn.com` é negado pelo proxy (CONNECT 403), então `shadcn init` e `shadcn add` falham. O GitHub e o npm funcionam.

**Problema/Contexto:** CLI `shadcn` 4.21.x busca `${REGISTRY_URL}/styles/<style>/<item>.json` e `${SHADCN_URL}/init` (SHADCN_URL = REGISTRY_URL sem `/r`). `REGISTRY_URL` padrão é `https://ui.shadcn.com/r`.
**Por que importa:** sem o registry não dá para instalar componentes oficiais, e escrevê-los de memória viola o `UI.md`.
**Como aplicar:**
1. `git clone --depth 1 https://github.com/shadcn-ui/ui` (fora do repositório), `pnpm install`.
2. `pnpm --filter=@shadcn/react build && pnpm --filter=@shadcn/helpers build && pnpm --filter="shadcn..." build`.
3. Em `apps/v4`: `bun run ./scripts/build-registry.mts --style all` e `--indexes --registry base-nova` (o bun já vem instalado).
4. `npx next dev --turbopack --port 4000` em `apps/v4`.
5. No projeto: `REGISTRY_URL=http://localhost:4000/r pnpm dlx shadcn@latest add <itens>`.
Fora do sandbox (máquina do desenvolvedor) o CLI funciona sem nada disso.
**Evidência:** sessão de 2026-10-14; `curl -sI https://ui.shadcn.com/r/index.json` → 403; `components/ui/*` instalados por esse caminho.
