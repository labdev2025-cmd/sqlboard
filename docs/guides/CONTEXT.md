# Project Context Files — AGENTS.md, CLAUDE.md and LEARNING.md

## Applicability and interoperability — revision 1.1 (2026-09-13)

This guide is independently usable. Companion guides are optional references: apply only the ones actually present and relevant to the task. A missing companion never requires installing the whole set, inventing its contents, or stopping work covered by this guide. Paths and project names in examples are templates, not facts about the current repository.

Honor the agent runtime's permissions and higher-priority instructions. Within project guidance, follow the explicit task, then applicable repository instructions and established conventions, then documentation for the installed version, then this guide's defaults. Existing insecure behavior is not a convention to preserve: fix it when in scope and report other findings. New-project defaults never authorize a dependency upgrade, migration, or restructuring of an existing project.

When guides are combined, topic ownership is: `COMMITS.md` for commit messages and Git actions; `CONTEXT.md` for `AGENTS.md`, `CLAUDE.md`, and project learning; `STRUCTURE.md` for file placement and build wiring; `JAVA.md` for backend implementation; `UI.md` for shadcn composition and APIs; `RESPONSIVENESS.md` for shared responsive/accessibility/PWA criteria. Product requirements decide whether PWA/offline is needed. Each guide retains the essentials needed when its companions are absent.

Mandatory rules apply within the requested scope. Validate changed behavior and concrete risks; use a full application audit only for a new application, a cross-cutting change, or an explicitly requested audit. Stop when the applicable acceptance criteria pass, or report a concrete environment blocker and the pending checks. Never claim an unexecuted check passed.

Deliver one report: outcome, relevant verification, and material limitations. Include a tree only for structural work and a suggested commit message when useful or requested; neither must be the last line. If the project learning workflow is active, put its short `LEARNING:` status last. Writing a suggested message never authorizes a commit or push.

---

**Version:** 1.1 — 2026-09-13  
**Scope:** create, update and maintain portable project instructions and an evidence-backed, git-versioned knowledge base. Applies to an existing project, a new application, a library or a single script.  
**Language:** shared instructions and Claude-specific instructions in English by default; learning entries, README and ADRs in pt-BR. Existing repository language conventions take precedence.

**Required result when this guide is invoked for setup:** create or update `AGENTS.md`, `CLAUDE.md` and `LEARNING.md`. Create a root `AGENTS.md` even when Claude Code is the only agent currently used. Never leave the portable entry point dependent on a future agent migration.

Read Parts 0–2 for instructions and entry points; Part 3 for learning; Part 4 for setup/update; Part 5 for normal work; Part 6 for maintenance. Read only the part required for the task. The six guides in this set are independently usable; this document includes its own complete context-file procedure.

---

## 0. Working rules

### 0.1 Required, recommended and conditional

- **[REQUIRED]** is part of the applicable task's acceptance criteria. Report a concrete blocker or justified exception; never silently skip it.
- **[RECOMMENDED]** is a default that may change for a stated project reason.
- **[CONDITIONAL]** applies only when its condition is true.

### 0.2 Precedence and ownership

Honor runtime permissions and higher-priority instructions, then the explicit task, applicable repository instructions/conventions, installed-tool documentation, and this guide's defaults. This guide owns the content of project context files. `STRUCTURE.md`, if present, owns their placement and tool configuration; `COMMITS.md`, if present, owns commit format and Git actions. A missing companion never blocks this workflow.

Preserve existing decisions unless changing them is in scope. Resolve contradictions using evidence and the user's stated intent. If an unresolved conflict changes business behavior or permissions, report it and continue unaffected work; do not silently choose a new policy.

### 0.3 Agent working rules [REQUIRED]

- Read before writing: audit existing instruction files, relevant build files and actual commands (Part 4).
- Preserve human-written project rules. Update existing files in place. Moving common rules from `CLAUDE.md` into `AGENTS.md` is part of adopting this guide; keep their meaning and report substantive removals. Do not replace curated content with generic examples.
- Never invent commands, paths, versions, architectural decisions, test outcomes or learnings. Execute a documented command or mark it `(not verified)` with the reason.
- Keep one canonical copy of each shared instruction in `AGENTS.md`. The Claude bridge imports it; other agents can read it directly.
- Never paste these large guides into the entry points or import them with `@`. Use ordinary backticked paths and a short explanation of when to read each relevant section.
- Do not put secrets, credentials, personal judgments, URLs with tokens, or unnecessary personal data in committed context files. Personal overrides stay local.
- Never commit or push unless asked. The authorized task can include routine correction/retry of a failed check; never bypass a hook or permission boundary.
- Keep the task report proportional: result, verification and limitations; learning status last when this workflow is active. Do not require a transcript of the work.

### 0.4 Invocation

`Leia docs/guides/CONTEXT.md e execute a Parte 4.` The agent detects which files already exist and updates them. The guide can live elsewhere; use the actual path. A reusable skill may point to this procedure when the repository already uses skills; creating a skill is not required.

## 1. Responsibilities and loading

### 1.1 Four places knowledge lives

| File/mechanism | Contains | How it is read | Shared |
| --- | --- | --- | --- |
| `AGENTS.md` | Canonical shared project instructions: purpose, commands, constraints, relevant guide pointers and the learning workflow | Natively by agents that support it; explicitly by other agents or their documented adapter | Through git |
| `CLAUDE.md` | Imports of shared instructions and the learning index; only Claude-specific additions | By Claude Code according to its documented loading rules | Through git |
| `LEARNING.md` + `docs/learning/` | Team knowledge: non-obvious causes, gotchas, decisions, failed approaches and measurements | Index at task start; matching topic files on demand | Through git |
| Agent auto memory / personal local files | Agent-specific or personal preferences and notes | Depends on the tool | Do not assume synchronization or team visibility |

Do not assume every AI tool automatically discovers `AGENTS.md`, parses Claude's `@` imports, or shares Claude's context limits. Confirm the selected agent's support. If it lacks discovery, configure its documented entry point to read `AGENTS.md` or explicitly instruct it to do so. The portable file still exists.

### 1.2 Single source of truth [REQUIRED]

`AGENTS.md` must be useful without reading `CLAUDE.md` or `.claude/rules/`. All instructions needed by other agents, including how to read/update learning, belong there. Claude-specific settings, commands and compaction hints belong in `CLAUDE.md` or `.claude/`.

`AGENTS.md` never imports or instructs the agent to load `CLAUDE.md` as a shared dependency. The dependency direction is `CLAUDE.md` → `AGENTS.md`; never the reverse and never a cycle. Use real Markdown files by default, avoiding a symlink requirement on Windows.

### 1.3 Where a fact belongs

| Knowledge | Canonical place |
| --- | --- |
| A rule all agents need for the project | `AGENTS.md` |
| Verified run/test commands and their working directories | `AGENTS.md` |
| Claude-only compaction or tool behavior | `CLAUDE.md` |
| A non-obvious learning with evidence and a reason | `docs/learning/<category>-<slug>.md`, indexed in `LEARNING.md` |
| Architecture decision already in an ADR | ADR; a short learning pointer only when it helps retrieval |
| Scoped shared instructions | A nested `AGENTS.md` where the agent supports it; document the scope in the root |
| Scoped Claude-specific pointers | `.claude/rules/` or a nested Claude bridge when needed |
| Personal settings or sandbox values | Tool-specific gitignored local settings, such as `CLAUDE.local.md` |
| Current task state or information obvious from code/diff/history | Current task report or existing authoritative source; do not manufacture a permanent entry |

A hardened learning may become a one-line rule in `AGENTS.md`. Keep the topic file only for supporting evidence and rationale; do not maintain two independent copies of the rule.

### 1.4 Language and naming

| Element | Default |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | English; literal identifiers, commands and paths preserved |
| `LEARNING.md` headings/hooks and topic bodies | pt-BR with accents and established technical terms |
| Frontmatter keys and classifier values | English |
| Topic filename | `<category>-<slug>.md`, kebab-case, no accents |
| Dates | Absolute ISO 8601 dates; never hardcode the sample date into a new entry |

## 2. The project entry points

### 2.1 Location and context budget [REQUIRED]

- `AGENTS.md` lives at the repository root, including repositories with sibling `backend/` and `frontend/` directories.
- Create `CLAUDE.md` at the root for a new project. If the project already uses `.claude/CLAUDE.md`, keep that location and adjust relative imports. Do not create a second competing bridge.
- Aim for roughly 60–140 lines in `AGENTS.md` and 2–15 lines in the Claude bridge. Use fewer for a script. These are editorial targets, not universal tool limits.
- Keep the combined shared instructions, bridge and learning index within the selected agent's actual context budget. Imports still consume context.
- A nested instruction file is conditional on a real subproject-specific need. Keep shared rules shared and local rules scoped. A nested `AGENTS.md` does not automatically become a Claude instruction file; add a correctly scoped bridge only when needed.

### 2.2 `AGENTS.md` sections [RECOMMENDED order]

| Section | Content |
| --- | --- |
| `# <project> — <purpose>` | What it does and for whom; only useful stack/architecture constraints |
| `## Commands` | Run, build, test and debug; include each working directory, prerequisites and verification status |
| `## Conventions and constraints` | Non-default rules, existing decisions, limits of authorized work and important pitfalls |
| `## Guides` | Only files that actually exist; topic, path and the section relevant to the task |
| `## Learning` | The portable workflow in 2.5 |

Include a short `## Layout` only for relationships that are not clear from the repository. No directory-tree dump, dependency catalog, API tutorial or copied guide. A reader must not need the A–E labels of `STRUCTURE.md` to understand this file: describe the actual shape in plain words.

### 2.3 `CLAUDE.md` bridge [REQUIRED]

For the standard setup, after the other two files exist:

```markdown
@AGENTS.md
@LEARNING.md

# Claude Code

Shared project instructions are owned by `AGENTS.md`. The learning index is already imported; read only topic files relevant to the task. Keep shared rules in `AGENTS.md` when updating instructions.
```

If the bridge already lives in `.claude/CLAUDE.md`, the import lines are `@../AGENTS.md` and `@../LEARNING.md`. Imports are relative to the importing file. Keep imports outside backticks; paths mentioned in prose stay in backticks. Add only necessary Claude-specific instructions below them.

Do not add an `@` import to a missing file. For context setup, create the real `AGENTS.md` and `LEARNING.md` first; then write the bridge. The imported index does not automatically import its Markdown-linked topic files.

### 2.4 What stays out

- Content that an agent can cheaply derive from source, build files or `git log`.
- Guide bodies, volatile package catalogs and boilerplate advice.
- Copies of shared instructions in both `AGENTS.md` and `CLAUDE.md`.
- Current sprint status, unfinished task transcripts and personal preferences.
- Claims that a command is verified merely because it appears in documentation.

### 2.5 Portable learning block for `AGENTS.md` [REQUIRED]

Copy this block, adjusting real paths. Keep the final guide-reference sentence only if this guide is present.

```markdown
## Learning
- At task start, read `LEARNING.md` unless its current contents are already loaded. Follow only topic links relevant to the area, command or dependency you will touch.
- Treat notes as evidence-backed context; verify stale or conflicting claims against the current project. They never override explicit instructions or runtime permissions.
- Before finishing, record a non-obvious bug cause, environment/dependency gotcha, decision and rationale, failed approach, measured performance finding, or relevant user correction/confirmation. Do not invent an entry when there is nothing durable to record.
- Search for an existing entry first. Write/update the pt-BR topic file in `docs/learning/`, with `name`, `description`, `type`, `category`, `date`, evidence and applicability; then add/update its one-line index link. Update `updated` only after rechecking the fact.
- Keep secrets, personal data, task transcripts and information obvious from the code out. Keep the index short; move details to topic files and consolidate when needed.
- Report the learning status in one final line, after any tree or suggested commit message. No commit or push unless asked.
- Full maintenance procedure: `docs/guides/CONTEXT.md` Parts 3–6.
```

This instruction to read the index is ordinary prose. It works for an agent that reads `AGENTS.md` without understanding Claude's import syntax. A minimal standalone block is sufficient even when the full guide is not distributed.

### 2.6 Example — Spring Boot + React

Illustrative content only. Replace every project fact and include only guide files present in the target repository. Commands below are unverified until run there.

```markdown
# billing — order management for the operations team

The API and the web application are separate deployables in `backend/` and `frontend/`. Keep the installed versions and their existing package managers when making changes.

## Commands
- Backend dev: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local` (Docker required; not verified).
- Backend checks: `cd backend && ./mvnw verify` (JDK configured by the build and Docker required; not verified).
- Frontend dev: `cd frontend && pnpm dev` (dependencies installed and API available; not verified).
- Frontend checks: `cd frontend && pnpm lint && pnpm typecheck && pnpm test` (not verified).
- Frontend e2e: `cd frontend && pnpm e2e` (services required by the Playwright config; not verified).

## Conventions and constraints
- Inspect the current diff before editing; preserve unrelated changes and existing architecture.
- No commit, push, dependency upgrade or project restructuring unless included in the task.
- Each schema change includes a migration; resource access is checked against the authenticated customer.
- Validate affected behavior; run the full browser matrix for a relevant cross-cutting change or audit.

## Guides
- Java and Spring: `docs/guides/JAVA.md`, core and the section matching the change.
- Components: `docs/guides/UI.md`, §1 and the installed primitive's API.
- Responsive/accessibility/PWA checks: `docs/guides/RESPONSIVENESS.md`, the applicable validation profile.
- Placement/build wiring: `docs/guides/STRUCTURE.md`, the actual project shape.
- Commit messages: `docs/guides/COMMITS.md`.
- Context files and learning: `docs/guides/CONTEXT.md`.

## Learning
- Read `LEARNING.md` at task start; open relevant topic files in `docs/learning/`.
- Record only durable, non-obvious facts with evidence; update an existing entry before adding a duplicate. Write the topic file before its index link.
- Apply `docs/guides/CONTEXT.md` Parts 3–6. Keep shared rules here and Claude-specific behavior in `CLAUDE.md`.
- End the task report with `LEARNING: <entries updated or no durable learning>`; do not commit unless asked.
```

Then create the bridge from 2.3. For a script, reduce the example to its actual purpose, run/test commands and learning block; never manufacture Maven, Node or frontend commands for a project that does not use them.

## 3. `LEARNING.md` and topic files

### 3.1 Shape [REQUIRED]

```text
LEARNING.md                      # short index, not a diary
docs/learning/
  bug-<slug>.md
  gotcha-<slug>.md
  decision-<slug>.md
  failed-<slug>.md
  perf-<slug>.md
  reference-<slug>.md
```

Target an index below 200 lines and 25 KB. These are this guide's maintenance limits. `@LEARNING.md` is imported whole by Claude; the index is not truncated using the auto-memory `MEMORY.md` limit. Other agents' limits differ.

### 3.2 Index

```markdown
# LEARNING.md — base de conhecimento do projeto

Leia as entradas relacionadas à tarefa. Os detalhes ficam em `docs/learning/`.

## Bugs e soluções
## Pegadinhas de ambiente, dependências e bibliotecas
## Decisões de arquitetura
## Abordagens que NÃO funcionaram
## Notas de performance
## Referências externas
```

Each real entry adds one line under its category, for example:

```markdown
- [Consultas de pedido respeitam o proprietário](docs/learning/bug-proprietario-pedido.md) — acesso por id e listagem precisam restringir o cliente autenticado.
```

Use a specific one-line hook, roughly 150 characters when practical. Group by category and area, not by chronology. The index contains no entry bodies, frontmatter, stack traces or multi-paragraph summaries. Never add an example entry without evidence from the project.

### 3.3 Topic format [REQUIRED]

```markdown
---
name: <nome curto>
description: <fato e gatilho específicos em uma linha>
type: project
category: bug
date: <YYYY-MM-DD>
---
<Conclusão ou insight acionável em uma ou duas frases.>

**Problema/Contexto:** <sintoma, restrição e versões relevantes>
**Por que importa:** <impacto de repetir o erro ou perder a decisão>
**Como aplicar:** <quando e onde a conclusão vale; limites conhecidos>
**Evidência:** <arquivo, teste/comando com resultado, commit, ADR, issue ou instrução explícita do usuário>
```

Use 10–40 lines as a default, more only when the evidence needs it. Set `updated: YYYY-MM-DD` after re-verification. Preserve the original `date`. These fields are a portable project convention, not a required parser contract of every AI tool. Similarity to an agent's auto-memory format does not make the project directory an auto-memory store.

### 3.4 Categories and types

| Category | Record | Default `type` |
| --- | --- | --- |
| `bug` | Non-obvious cause, misleading symptom and prevention | `project` |
| `gotcha` | Environment/library behavior whose applicability is not obvious | `project` |
| `decision` | Chosen approach, rationale and alternatives; link an existing ADR | `project` |
| `failed` | An approach that actually failed, why, and the replacement | `project` |
| `perf` | Measured before/after result, workload and method | `project` |
| `reference` | Relevant external project resources without credentials | `reference` |

Use `feedback` when recording an explicit human correction or confirmation. Failure alone does not imply human feedback. Personal `user` memories stay out of the team knowledge base. Record successes as well as failures when they contain durable, non-obvious information.

## 4. Create or update mode

### 4.1 Audit first [REQUIRED]

1. Locate `AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md`, nested instruction files, `LEARNING.md`, `docs/learning/`, relevant `.claude/rules/`, README and contribution/ADR files. Do not copy personal local overrides into shared files.
2. Read the instruction files and the build files relevant to the project: Maven/Gradle, Node scripts and lockfile, runtime pins, Compose, CI, scripts and environment examples. Inspect actual files rather than assuming the sample layout.
3. Inspect current changes and relevant recent Git history. Keep unrelated staged and unstaged changes intact.
4. Run the cheap relevant commands needed to document the project, with their correct working directories. Run broader checks when the change or claimed verification requires them. Missing Docker, network or SDK is a documented blocker, not a pass and not a reason to change the target stack.
5. Collect real candidate learnings from observed errors, tests, existing ADRs, verified workarounds and explicit decisions. Do not scrape personal or secret data into memory.

### 4.2 New context files

1. Write root `AGENTS.md` from verified project facts, including the portable learning block and only existing guide pointers.
2. Create `LEARNING.md`. Create `docs/learning/` when adding its first real topic file. Zero entries is valid; add up to a few strong initial entries when the audit provides evidence.
3. Write `CLAUDE.md` with the imports in 2.3. Confirm both destinations exist and that no reverse import creates a cycle.
4. Ensure personal overrides and local tool settings are gitignored. Keep shared context files committed when the human authorizes a commit.
5. Verify the three files with 4.5 and report with 4.6.

### 4.3 Existing project: preserve and consolidate

| Existing state | Action |
| --- | --- |
| Only `CLAUDE.md` | Create root `AGENTS.md`; move shared project rules there without changing their intent. Keep Claude-only instructions and add the import bridge in the existing Claude file. |
| Only `AGENTS.md` | Keep it canonical; add the missing learning workflow and create the Claude bridge. |
| Both exist | Merge missing shared knowledge into `AGENTS.md`, remove equivalent copies from the bridge, keep Claude-specific additions. Report substantive conflict resolutions. |
| Neither exists | Follow create mode. |
| Existing `.claude/CLAUDE.md` | Preserve its location; import `@../AGENTS.md` and `@../LEARNING.md`. |
| Several scoped files | Keep their scopes. Do not flatten local exceptions into a global rule or assume a nested file's semantics are identical across agents. |

Existing `AGENTS.md` and `CLAUDE.md` are updated in place; do not replace their contents with the example. Preserve rules you cannot confidently classify, flag the unresolved question, and continue non-conflicting updates. Do not copy an entire guide into either file to reconcile a missing pointer.

Create the learning index if absent. Correct documented commands only on evidence; if unavailable, retain the useful command with a verification note. Mark dates using the actual review date.

### 4.4 Legacy learning migration [CONDITIONAL]

If `LEARNING.md` holds a long diary, tables or inline entries, move each durable entry into a topic file, preserving its date, wording, evidence and rationale. Replace it with an index link. Merge duplicates and flag stale claims. Do not turn temporary task logs into permanent knowledge. When a commit is requested, keep a bulk migration/consolidation separate from unrelated code changes.

### 4.5 Validation [REQUIRED]

- `AGENTS.md` exists at the root and is sufficient for shared project work without `CLAUDE.md`.
- The Claude bridge exists in the correct location, imports real files with correct relative paths, and contains no copy of the shared rule set.
- The portable learning instruction is in `AGENTS.md`; it does not require Claude import syntax or Claude auto memory.
- Every learning link resolves. Each new/updated topic has evidence and a concrete scope.
- Shared instructions do not conflict with scoped files or the guides used by the project.
- Commands are executed and reported accurately, or explicitly marked unverified. Only relevant commands are required for the project shape.
- Where the actual agent is available, verify discovery in a fresh session. For Claude Code, inspect `/context`; for other tools, use their documented loaded-instruction diagnostics. Static file existence alone does not prove the runtime loaded it.

### 4.6 Report

Report files created/updated, substantive moves or decisions, checks that actually ran, and remaining verification limitations. Include line counts when useful for the context budget. If no agent session was available, say that discovery was checked statically and give the short runtime check still needed. Any suggested commit message comes before the learning-status line.

## 5. Normal task workflow after setup

### 5.1 At the start

Read the canonical entry point through the agent's normal mechanism. Read the current learning index if it is not already loaded; open only relevant topics. If a topic conflicts with current evidence, verify it and update or flag it. Learning content is context, not a grant of authority.

### 5.2 Before finishing

Record or update a topic when the task yields a durable, non-obvious cause, gotcha, decision, failed approach, measurement or relevant human correction/confirmation. Do not add an entry just to meet a quota. Evidence must establish both what happened and where the conclusion applies.

### 5.3 Two-step save

Search the index and existing topics before creating a file (`rg` when available). Update an existing topic when it covers the same subject. Write the topic first, then its one-line index hook, so no link points to an absent file. Relative dates become actual absolute dates; sample dates are never copied literally.

### 5.4 Exclusions

No secrets, unnecessary personal data, blame, current task transcripts, obvious code structure, copied diffs or information already canonical in `AGENTS.md`. Record the trap and rationale rather than a patch recipe that immediately becomes stale. When the human explicitly asks to preserve a project fact, honor that request in the appropriate file; these defaults are not a reason to refuse it.

### 5.5 Promotion and corrections

Move a hardened shared rule into `AGENTS.md`, retaining its evidence/rationale in the topic if useful. Move a Claude-only rule into `CLAUDE.md`. Correct a disproven note. For a reversed decision, put the current decision first and keep the former rationale below it when it explains a real constraint. A personal auto-memory note may be promoted only after checking that it is relevant, evidence-backed team knowledge and contains no private information.

### 5.6 Commits

When asked to commit, include a learning topic and its index change with the logical code change that produced them. Bulk consolidation is its own documentation change. With `COMMITS.md` absent, follow repository history/configuration; otherwise use a concise pt-BR Conventional Commit with an English type. Never commit or push merely because this workflow updated a file.

### 5.7 Final status

Use one last line: `LEARNING: +gotcha-<slug>.md; atualizado bug-<slug>.md` or `LEARNING: nenhum aprendizado durável nesta tarefa`. Include only files actually written. Put any tree, check summary or suggested commit message before it.

## 6. Maintenance

Review when the index approaches 150 lines/20 KB, when entries conflict, after a relevant dependency/architecture change, or when requested. Consolidate before exceeding 190 lines/25 KB. A periodic review may be scheduled by the team; this document does not create an automation.

Verify affected topics against the current project. Merge duplicates; keep the oldest creation date and set `updated` only after verification. Preserve still-relevant failed approaches and reversed decisions. Unverifiable entries remain flagged rather than being silently declared current. Check links and remove empty/stale hooks. Promote rules to `AGENTS.md` without duplicating them in the Claude bridge.

## 7. Anti-patterns

| Anti-pattern | Correction |
| --- | --- |
| Only `CLAUDE.md` exists | Create root `AGENTS.md` and the import bridge |
| `AGENTS.md` says only “read CLAUDE.md” | Put the shared content in `AGENTS.md` |
| Identical full content in both entry points | Keep one canonical copy and import it |
| Shared learning workflow exists only in `.claude/rules/` | Put the portable instruction in `AGENTS.md` |
| `@docs/guides/JAVA.md` imported on every launch | Ordinary pointer to the relevant guide section |
| All six guides required for context setup | Use this standalone procedure; list only guides present |
| A made-up command or learning | Verify it, mark it unverified, or omit the unsupported claim |
| Topic bodies in the index | One-line hooks and separate files |
| Agent auto-memory schema described as a universal requirement | Treat topic metadata as this project's convention |
| A “verified” label based only on reading code | Distinguish static inspection from execution |
| A routine failure causes an automatic permission request | Correct/retry within the existing task authorization |

## 8. Acceptance checklist

- [ ] Root `AGENTS.md` created or updated, even for a Claude-only starting project.
- [ ] `CLAUDE.md` bridge created or updated; relative imports resolve; no import cycle.
- [ ] Shared instructions and learning workflow are available independently of Claude.
- [ ] Existing project decisions, scopes and personal overrides preserved appropriately.
- [ ] `LEARNING.md` exists; topics contain evidence; index links resolve; no invented entries.
- [ ] Only present guides are referenced; no reliance on an external guide's layout labels.
- [ ] Commands and runtime-loading checks classified as executed, static-only, blocked or not applicable.
- [ ] One proportional report, with learning status last; no unauthorized commit/push.

## 9. Sources and revision procedure

- [Claude Code memory documentation](https://code.claude.com/docs/en/memory): checked 2026-09-13 for the documented `CLAUDE.md` → `AGENTS.md` import pattern, relative imports, context cost and the distinction between project files and auto memory.
- [AGENTS.md format](https://agents.md/): checked 2026-09-13 for the portable instruction-file convention. Actual discovery behavior still belongs to each agent's documentation.
- The learning categories, metadata, budgets and promotion rules are this guide's project conventions; they do not depend on a third-party transcription of an internal system prompt.

Revision 1.1 makes `AGENTS.md` mandatory, consolidates shared instructions, preserves the Claude bridge, clarifies standalone operation and fixes conflicting report requirements. Runtime loading was not exercised in a Claude Code or other agent session during this revision; verify it in the consuming project. Do not present static inspection as that runtime test.

For later revisions: record the date; check current official import/discovery mechanics; exercise a fresh session when available; review both a new project and an existing curated context pair; validate links, budgets and companion references; record what was actually tested. Keep old observations dated rather than relabeling them as newly verified.
