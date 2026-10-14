---
name: Playwright no sandbox usa o Chromium pré-instalado
description: O sandbox traz o Chromium em /opt/pw-browsers; com @playwright/test mais novo, aponte PLAYWRIGHT_CHROMIUM_EXECUTABLE em vez de rodar playwright install.
type: project
category: gotcha
date: 2026-10-14
---
O ambiente de nuvem tem `/opt/pw-browsers/chromium` (build 1194, Chromium 141) e define `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. O projeto usa `@playwright/test` 1.64, que espera outra build.

**Problema/Contexto:** `playwright install` não deve ser rodado no sandbox.
**Por que importa:** sem o caminho explícito o teste não encontra o navegador.
**Como aplicar:** `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm test:e2e`; `playwright.config.ts` usa a variável em `launchOptions.executablePath`. No CI o workflow roda `playwright install --with-deps chromium`.
**Evidência:** `pnpm test:e2e` verde em 2026-10-14 com essa variável.
