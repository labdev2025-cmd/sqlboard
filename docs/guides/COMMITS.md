# Git Commit Standards

## Applicability and interoperability — revision 1.1 (2026-09-13)

This guide is independently usable. Companion guides are optional references: apply only the ones actually present and relevant to the task. A missing companion never requires installing the whole set, inventing its contents, or stopping work covered by this guide. Paths and project names in examples are templates, not facts about the current repository.

Honor the agent runtime's permissions and higher-priority instructions. Within project guidance, follow the explicit task, then applicable repository instructions and established conventions, then documentation for the installed version, then this guide's defaults. Existing insecure behavior is not a convention to preserve: fix it when in scope and report other findings. New-project defaults never authorize a dependency upgrade, migration, or restructuring of an existing project.

When guides are combined, topic ownership is: `COMMITS.md` for commit messages and Git actions; `CONTEXT.md` for `AGENTS.md`, `CLAUDE.md`, and project learning; `STRUCTURE.md` for file placement and build wiring; `JAVA.md` for backend implementation; `UI.md` for shadcn composition and APIs; `RESPONSIVENESS.md` for shared responsive/accessibility/PWA criteria. Product requirements decide whether PWA/offline is needed. Each guide retains the essentials needed when its companions are absent.

Mandatory rules apply within the requested scope. Validate changed behavior and concrete risks; use a full application audit only for a new application, a cross-cutting change, or an explicitly requested audit. Stop when the applicable acceptance criteria pass, or report a concrete environment blocker and the pending checks. Never claim an unexecuted check passed.

Deliver one report: outcome, relevant verification, and material limitations. Include a tree only for structural work and a suggested commit message when useful or requested; neither must be the last line. If the project learning workflow is active, put its short `LEARNING:` status last. Writing a suggested message never authorizes a commit or push.

---

Instructions for an AI agent that writes commits in this repository. Follow these rules unless a repository-specific configuration file (`CONTRIBUTING.md`, `.gitmessage`, `commitlint.config.js`) says otherwise. Repository conventions always win over this document.

**Language policy:** this document is written in English, but every commit message you produce must be written in Brazilian Portuguese (pt-BR). See section 2.

---

## 1. Before You Commit

Run these checks first. Do not skip them.

1. `git status` — confirm which files are staged and which are not.
2. `git diff --staged` — read the actual change you are about to record.
3. `git log --oneline -15` — match the existing style of the repository (prefix format, capitalization, language).

If the staged changes cover more than one logical concern, split them into separate commits after inspecting the diff. Use `git add -p` in an interactive session, or stage explicit files/hunks with a supported non-interactive method. Preserve pre-existing staged work and never include another person's changes without authorization.

**Never stage blindly.** Do not run `git add -A` or `git add .` without inspecting the result. These commands routinely capture build artifacts, `.env` files, credentials, editor settings, and debug output.

---

## 2. Language of the Commit Message

Commit messages are written in **Brazilian Portuguese**, with two exceptions that stay in English because tooling parses them:

| Element | Language | Example |
| --- | --- | --- |
| Type | English (fixed keyword) | `feat`, `fix`, `refactor` |
| Footer keywords | English (fixed keyword) | `BREAKING CHANGE:`, `Closes:`, `Refs:`, `Co-authored-by:` |
| Scope | Portuguese or the literal module name | `(autenticacao)`, `(parser)`, `(api)` |
| Subject | Brazilian Portuguese | `corrige vazamento de conexões` |
| Body | Brazilian Portuguese | full sentences |
| Footer text after the keyword | Brazilian Portuguese | migration notes, explanations |

Additional rules:

- **Write accents correctly.** `configuração`, `usuário`, `versão` — never strip diacritics from the subject or body. Scopes may drop accents for consistency with directory names (`(autenticacao)`).
- **Keep technical terms in English** when that is how the codebase and the team refer to them: `endpoint`, `cache`, `deploy`, `token`, `merge`, `build`, `commit`. Do not force translations like "ponto de extremidade" or "consolidação".
- **Do not mix languages inside one sentence** beyond those established technical terms.
- **If the repository's existing history is in English,** follow the repository and tell the human about the conflict with this rule instead of silently switching languages mid-history.

---

## 3. Message Structure

```
<type>(<scope>): <assunto>

<corpo>

<rodapé>
```

| Part | Required | Rule |
| --- | --- | --- |
| Type | Yes | Lowercase, from the table in section 4 |
| Scope | No | Lowercase noun in parentheses; the module or area touched |
| Subject | Yes | Present indicative, third person, no trailing period; complete header targets ≤ 50 characters and must be ≤ 72 |
| Blank line | Yes, if a body exists | Separates the subject from the body |
| Body | When the change needs it | Wrapped at 72 characters |
| Footer | When applicable | Breaking changes and issue references |

### Subject line — verb form

This guide adopts the **third-person singular present indicative** as a team convention: `adiciona`, `corrige`, `remove`, `atualiza`, `move`, `extrai`.

The test: the subject must complete the sentence *"Ao ser aplicado, este commit ___."*

- ✅ `adiciona validação de CPF no cadastro`
- ❌ `adicionada validação de CPF` (past participle)
- ❌ `adicionando validação de CPF` (gerund)
- ❌ `adicionar validação de CPF` (infinitive — acceptable only if the repository already uses it consistently; pick one form and never mix)

### Subject line — formatting

- Start with a lowercase letter after the colon.
- No period at the end.
- Count the complete first line, including type, scope, punctuation, spaces, and subject. Aim for ≤ 50 characters; 51–72 is allowed when it preserves clarity. The hard ceiling is 72 unless the repository configures another limit. Use Unicode character counts, not UTF-8 byte counts. Prefer a precise short description such as `fix(auth): corrige timeout no login`.
- Describe the change, not the file. `fix(auth): rejeita refresh tokens expirados` beats `atualiza auth.js`.

### Body

Include a body whenever the change is not self-explanatory from the subject alone. Explain **why**, not **what** — the diff already shows what changed. Cover:

- The problem or motivation behind the change.
- Why this approach was chosen over the obvious alternative.
- Side effects, performance implications, or follow-up work that is still needed.

Skip the body for genuinely trivial commits (typo fixes, dependency version bumps, formatting).

---

## 4. Types

| Type | Use for |
| --- | --- |
| `feat` | A new user-facing capability |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, semicolons — no logic change |
| `refactor` | Restructuring that neither fixes a bug nor adds a feature |
| `perf` | A change made specifically to improve performance |
| `test` | Adding or correcting tests |
| `build` | Build system, bundler, or dependency changes |
| `ci` | CI configuration and pipeline scripts |
| `chore` | Maintenance that does not touch `src/` or tests |
| `revert` | Reverting a previous commit |

Under a Conventional Commits release policy, `feat` normally maps to MINOR and `fix` to PATCH; a breaking change normally maps to MAJOR. SemVer itself does not parse commits. The actual release tool configuration, including pre-1.0 behavior, is authoritative.

---

## 5. Breaking Changes

This guide's preferred policy marks them in two places: a `!` before the colon and a `BREAKING CHANGE:` footer explaining the migration path. Conventional Commits itself accepts either marker; follow a repository policy that uses only one. The keyword stays in English; the explanation is in Portuguese.

```
feat(api)!: retorna timestamps em ISO 8601 nas respostas

Os inteiros em epoch Unix eram ambíguos entre fusos horários e
obrigavam cada cliente a reimplementar a conversão.

BREAKING CHANGE: os campos `created_at` e `updated_at` agora retornam
strings ISO 8601 em vez de inteiros. Clientes que fazem parse desses
valores como número precisam ser atualizados antes do deploy.
Consulte MIGRATION.md.
```

---

## 6. Footers

```
Refs: #482
Closes: #17
Co-authored-by: Jane Doe <jane@example.com>
```

Use `Closes:` only when the commit fully resolves the issue. Use `Refs:` for partial or related work.

---

## 7. Atomic Commits

One commit, one logical change. Each commit should build and pass its tests on its own, so that `git bisect` and `git revert` stay useful.

Signals that a commit should be split:

- The subject joins independent changes with "e". The word alone is not a reason to split a cohesive change.
- The diff touches unrelated modules.
- You are bundling a formatting pass with a behavior change. Reformatting and logic changes always belong in separate commits — mixing them makes the real change invisible in review.

---

## 8. Examples

**Good**

```
fix(cache): libera conexões do Redis ao estourar o timeout

As conexões vazavam sempre que a chamada ao serviço externo
ultrapassava o limite de 5s, esgotando o pool depois de cerca
de 2.000 requisições.

Closes: #331
```

```
refactor(parser): extrai validação de tokens para módulo próprio
```

```
docs(readme): documenta a variável de ambiente DATABASE_URL
```

```
perf(relatorios): reduz consultas do dashboard com eager loading
```

**Bad**

| Message | Problem |
| --- | --- |
| `arrumei umas coisas` | Past tense, says nothing |
| `Atualiza UserService.java` | Names the file, not the change; capitalized |
| `feat: adiciona login e corrige navbar e sobe versão` | Three commits pretending to be one |
| `WIP` | Not a description; squash before merging |
| `feat(auth): Adicionado novo sistema de autenticação.` | Past participle, capitalized, trailing period |
| `fix: corrigindo bug no carrinho` | Gerund instead of present indicative |
| `fix: corrige validacao de senha` | Missing accent (`validação`) |
| `feat: add user export` | English subject in a pt-BR repository |

---

## 9. Rules for AI Agents Specifically

- **Never commit without being asked.** Make the changes, report what you did, and let the human decide when to commit — unless they have explicitly told you to commit as you go.
- **Never push unless explicitly instructed.** Committing and pushing are separate decisions.
- **Never run `git commit --amend`, `git rebase`, `git reset --hard`, or force-push** on work you did not create in this session. These rewrite history that someone else may already have pulled.
- **Do not add attribution or promotional trailers** naming the AI tool that wrote the commit unless the repository's own conventions call for it.
- **Do not describe your process.** The commit records what changed in the codebase, not what you tried, retried, or how many attempts it took.
- **Do not invent issue numbers.** Reference an issue only when the human named it or you read it from the branch name or an existing file.
- **If a pre-commit hook fails, fix the underlying problem.** Do not use `--no-verify` to bypass it.
- **If a hook or message check fails,** inspect the reason and make a correction within the authorized commit task. Retry the same logical change without bypassing the gate. Ask only when resolving it requires a new decision, changing unrelated work, or an action outside the authorization.
- **Write the message in Portuguese even when the conversation with the human is in English.** The message language follows this document, not the chat.

---

## 10. Quick Checklist

- [ ] Changes inspected with `git diff --staged`
- [ ] Nothing secret, generated, or unrelated is staged
- [ ] Type is accurate, lowercase, and in English
- [ ] Subject is in pt-BR, present indicative, no period; complete header targets ≤ 50 characters and is ≤ 72 (or the repository limit)
- [ ] Accents are correct
- [ ] Body explains *why*, in pt-BR (or the change is genuinely trivial)
- [ ] Breaking changes carry `!` and a `BREAKING CHANGE:` footer
- [ ] Commit is atomic and would pass tests on its own

## 11. Maintenance and verification

The 50/72 convention and verb form are team preferences; repository configuration wins. Inspect actual staged bytes before every authorized commit. See [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for the interoperable syntax. Revision 1.1 reviewed the examples and clarified the limits; it did not execute commits in a project.
