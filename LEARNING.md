# LEARNING.md — base de conhecimento do projeto

Leia as entradas relacionadas à tarefa. Os detalhes ficam em `docs/learning/`.

## Bugs e soluções
- [Cancelamento atrasado atinge a próxima query do pool](docs/learning/bug-kill-atrasado-pool.md) — espere o KILL/cancel antes de devolver a conexão.
- [Rollback no SQL Server com request ativo](docs/learning/bug-mssql-rollback-com-request-ativo.md) — decida no evento "done"; senão a conexão vaza e o close() trava.
- [Validador de SQL precisa ler comentários e aspas como cada banco](docs/learning/bug-tokenizador-comentarios-por-banco.md) — SQL Server aninha /* */; MySQL executa /*! */ e exige espaço após --.
- [Ordenar int8/numeric como number perde precisão](docs/learning/bug-ordenacao-int8-precisao.md) — compare o texto decimal; Number() iguala valores acima de 2^53.
- [Worker do SQLite não acha o driver no build](docs/learning/bug-sqlite-worker-modulo-bundler.md) — require.resolve vira id do bundler; resolver dentro do código do worker.

## Pegadinhas de ambiente, dependências e bibliotecas
- [Registry do shadcn bloqueado no sandbox](docs/learning/gotcha-shadcn-registry-bloqueado.md) — rode o site do shadcn local (GitHub) e use REGISTRY_URL.
- [TypeScript 6 e ESLint 9 fixados](docs/learning/gotcha-versoes-typescript-eslint.md) — typescript-eslint exige TS < 6.1; eslint-plugin-react aceita ESLint ≤ 9.
- [Rate limit do Better Auth no e2e](docs/learning/gotcha-better-auth-rate-limit-e2e.md) — logins seguidos viram 429; o e2e desliga com SQLBOARD_AUTH_RATE_LIMIT=off.
- [MySQL encerra SLEEP interrompido sem erro](docs/learning/gotcha-mysql-sleep-interrompido.md) — timer no cliente + flags de cancelado/timeout no adapter.
- [SQL Server só é testado no CI](docs/learning/gotcha-sql-server-so-no-ci.md) — apt bloqueado e sem Docker; serviço no CI com REQUIRE_DB_TESTS=1.
- [error.tsx do Next 16.4 recebe retry](docs/learning/gotcha-next-error-retry.md) — não use reset(); leia a doc instalada dos arquivos especiais.
- [Chromium do Playwright no sandbox](docs/learning/gotcha-playwright-chromium-sandbox.md) — use PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium.

## Decisões de arquitetura
- [MCP e tokens com os acessos de quem criou](docs/learning/decision-mcp-tokens.md) — agentes editam rascunhos e queries; publicar, agendar, escrita e administração só pela sessão.
- [Construtor acompanha mudanças externas](docs/learning/decision-construtor-ao-vivo.md) — consulta a cada 3 s sem edição pendente; compactação da grade não suja o rascunho.
- [Estrutura sem src/ e API em Route Handlers](docs/learning/decision-estrutura-sem-src.md) — convenção do template shadcn; permissões centralizadas em server/http.ts e services.

## Abordagens que NÃO funcionaram

## Notas de performance

## Referências externas
