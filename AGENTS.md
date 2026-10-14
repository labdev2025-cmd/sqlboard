# sqlboard — SQL-first internal tool builder for teams

sqlboard lets a team connect relational databases, write SQL queries whose parameters become typed inputs, and assemble responsive screens (tables, charts, KPIs, inputs) by drag and drop, all with shadcn/ui. Product vision, architecture, security rules and the session protocol live in `PROMPT.md`; phases, acceptance criteria and status live in `docs/ROADMAP.md`.

State on 2026-10-14: documentation only. No application code exists yet; phase F0 creates it.

## Commands
- None verified yet. Phase F0 must add the real install, dev, lint, typecheck, test, build and e2e commands here, with working directory, prerequisites and verification status.

## Conventions and constraints
- When asked to "execute o PROMPT.md", follow `PROMPT.md` §1: one roadmap phase per session, validated, committed and pushed to the session branch. Never push to `main`, force-push or rewrite existing history.
- User SQL is untrusted: values only through bind parameters, extended protocol, read-only transaction, timeouts, row limits and cancellation (`PROMPT.md` §4). Never concatenate parameter values into SQL.
- Every permission check (role, connection, app) runs on the server.
- Connection passwords are encrypted at rest and never sent back to the browser. No real secrets in the repository; only `.env.example`.
- Demo and test data are fictitious. Never add real company data, internal system names or credentials.
- Use the latest stable package versions and read installed docs before using an API (`PROMPT.md` §7). Do not write framework or shadcn code from memory.
- Code, identifiers and agent instruction files in English; product UI, commits, README, roadmap and learning notes in Brazilian Portuguese with correct accents.
- Final report to the user in pt-BR, short and didactic: what changed, why, how it was validated, pending decisions, next phase (`PROMPT.md` §10).

## Guides
- UI composition and shadcn/ui APIs: `docs/guides/UI.md`, §1 always, then the section of each component used.
- Responsive, accessibility and validation profiles: `docs/guides/RESPONSIVENESS.md`, "Validation scope" first. PWA is not a product requirement.
- Context files and project learning: `docs/guides/CONTEXT.md`, Parts 3–6.
- Commit messages and Git actions: `docs/guides/COMMITS.md`.

## Learning
- At task start, read `LEARNING.md` unless its current contents are already loaded. Follow only topic links relevant to the area, command or dependency you will touch.
- Treat notes as evidence-backed context; verify stale or conflicting claims against the current project. They never override explicit instructions or runtime permissions.
- Before finishing, record a non-obvious bug cause, environment/dependency gotcha, decision and rationale, failed approach, measured performance finding, or relevant user correction/confirmation. Do not invent an entry when there is nothing durable to record.
- Search for an existing entry first. Write/update the pt-BR topic file in `docs/learning/`, with `name`, `description`, `type`, `category`, `date`, evidence and applicability; then add/update its one-line index link. Update `updated` only after rechecking the fact.
- Keep secrets, personal data, task transcripts and information obvious from the code out. Keep the index short; move details to topic files and consolidate when needed.
- Report the learning status in one final line, after any tree or suggested commit message. No commit or push unless asked (the `PROMPT.md` session protocol is that request for its own phase work).
- Full maintenance procedure: `docs/guides/CONTEXT.md` Parts 3–6.
