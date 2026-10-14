<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# sqlboard — SQL-first internal tool builder for teams

sqlboard lets a team connect relational databases, write SQL queries whose parameters become typed inputs, and assemble responsive screens (tables, charts, KPIs, inputs) by drag and drop, all with shadcn/ui. Product vision, architecture, security rules and the session protocol live in `PROMPT.md`; phases, acceptance criteria and status live in `docs/ROADMAP.md`; audit passes in `docs/AUDITORIA.md`.

Stack: Next.js 16 (App Router, `output: "standalone"`), TypeScript 6 (strict), pnpm, shadcn/ui on Base UI (`base-nova`), Tailwind 4, Drizzle + PostgreSQL for metadata, Better Auth, Vitest, Playwright + axe.

## Layout
- No `src/`: the shadcn `next` template convention. `app/` (routes; `(auth)` and `(app)` groups, JSON API under `app/api`), `components/ui/` (shadcn, owned code), `components/` (product compositions), `features/<area>/` (client screens), `server/` (server-only: `db`, `auth`, `crypto`, `datasources`, `execution`, `services`), `lib/` (pure modules shared by client and server, e.g. `lib/sql-params`).
- Every API route goes through `route()` in `server/http.ts` (session, role check, uniform errors). Services in `server/services/*` hold the permission rules.

## Commands
Run from the repository root. Prerequisites: Node 22+, pnpm 10, PostgreSQL 16 (local service or `docker compose up -d postgres`), `.env` copied from `.env.example`. All verified on 2026-10-14 in the cloud environment.
- `pnpm install` — dependencies.
- `bash scripts/dev-setup.sh` (`pnpm setup`) — idempotent: starts Postgres, creates `sqlboard`, `sqlboard_test`, `sqlboard_demo` and the read-only demo user, loads fictitious data, migrates, seeds the "Demo" connection. `ADMIN_DATABASE_URL` overrides the superuser connection (CI); `SKIP_DEMO_DATA=1` keeps existing demo data.
- `pnpm dev` — development server on :3000.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.
- `pnpm test` — Vitest (unit + integration against real Postgres; recreates `sqlboard_test`).
- `pnpm build` then `pnpm start` — standalone production server (`scripts/start.mjs`).
- `pnpm test:e2e` — Playwright against the production build (run `pnpm build` first); recreates `sqlboard_e2e`. In the cloud sandbox set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium` (do not run `playwright install`).
- `pnpm db:generate --name <nome>` after changing `server/db/schema.ts`; `pnpm db:migrate`; `pnpm db:seed`.
- shadcn CLI: `ui.shadcn.com` is blocked by the sandbox proxy; see `docs/learning/gotcha-shadcn-registry-bloqueado.md` for the local registry workaround.

## Conventions and constraints
- When asked to "execute o PROMPT.md", follow `PROMPT.md` §1: build every unchecked roadmap item in the same session, then run the audit pass; commit and push directly to `main` (no branches or pull requests) after each verified block. Never force-push, rewrite history or leave `main` broken.
- User SQL is untrusted: values only through bind parameters, extended protocol, read-only transaction, timeouts, row limits and cancellation (`PROMPT.md` §4). Never concatenate parameter values into SQL.
- Every permission check (role, connection, app) runs on the server.
- Connection passwords are encrypted at rest and never sent back to the browser. No real secrets in the repository; only `.env.example`.
- Demo and test data are fictitious. Never add real company data, internal system names or credentials.
- Use the latest stable package versions and read installed docs before using an API (`PROMPT.md` §7). Do not write framework or shadcn code from memory.
- TypeScript stays on 6.0.x while `typescript-eslint` requires `<6.1`; ESLint stays on 9 for `eslint-plugin-react`.
- Code, identifiers and agent instruction files in English; product UI, commits, README, roadmap and learning notes in Brazilian Portuguese with correct accents.
- Final report to the user in pt-BR, short and didactic: what changed, why, how it was validated, pending decisions, overall status (`PROMPT.md` §10).

## Guides
- UI composition and shadcn/ui APIs: `docs/guides/UI.md`, §1 always, then the section of each component used. Base UI: `render={<X />}`, never `asChild`.
- Responsive, accessibility and validation profiles: `docs/guides/RESPONSIVENESS.md`, "Validation scope" first. PWA is not a product requirement.
- Context files and project learning: `docs/guides/CONTEXT.md`, Parts 3–6.
- Commit messages and Git actions: `docs/guides/COMMITS.md`.

## Learning
- At task start, read `LEARNING.md` unless its current contents are already loaded. Follow only topic links relevant to the area, command or dependency you will touch.
- Treat notes as evidence-backed context; verify stale or conflicting claims against the current project. They never override explicit instructions or runtime permissions.
- Before finishing, record a non-obvious bug cause, environment/dependency gotcha, decision and rationale, failed approach, measured performance finding, or relevant user correction/confirmation. Do not invent an entry when there is nothing durable to record.
- Search for an existing entry first. Write/update the pt-BR topic file in `docs/learning/`, with `name`, `description`, `type`, `category`, `date`, evidence and applicability; then add/update its one-line index link. Update `updated` only after rechecking the fact.
- Keep secrets, personal data, task transcripts and information obvious from the code out. Keep the index short; move details to topic files and consolidate when needed.
- Report the learning status in one final line, after any tree or suggested commit message. No commit or push unless asked (the `PROMPT.md` session protocol is that request).
- Full maintenance procedure: `docs/guides/CONTEXT.md` Parts 3–6.
