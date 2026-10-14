# sqlboard

Plataforma web *SQL-first* para equipes montarem ferramentas internas e painéis a partir de queries prontas.

1. Conecte um banco relacional (PostgreSQL primeiro; depois MySQL, SQLite e SQL Server).
2. Escreva a query. Parâmetros como `:placa` ou `{{data_inicio}}` viram campos de entrada automaticamente.
3. Monte a tela arrastando e soltando tabelas, gráficos, KPIs, filtros e botões, com visual shadcn/ui.
4. Publique e compartilhe com a equipe.

> **Status:** em construção. O código ainda não existe; o projeto é construído em fases pelo Claude Code.

## Como o projeto é construído

| Arquivo | Papel |
| --- | --- |
| `PROMPT.md` | Prompt de construção: visão, arquitetura, regras de segurança e protocolo de cada sessão |
| `docs/ROADMAP.md` | Fases, critérios de aceite e status |
| `AGENTS.md` / `CLAUDE.md` | Instruções do projeto para agentes de IA |
| `LEARNING.md` + `docs/learning/` | Aprendizados registrados durante o desenvolvimento |
| `docs/guides/` | Guias de UI (shadcn/ui), responsividade, contexto e commits |

Para construir ou revisar o projeto, numa sessão do Claude Code (local ou na nuvem) com este repositório:

```text
execute o PROMPT.md
```

Cada execução constrói tudo o que falta no roadmap e depois faz uma passada de auditoria (revisa, corrige, refatora), commitando direto na `main`. Repetir o pedido em novas sessões gera novas passadas de auditoria; o resumo de cada uma fica em `docs/AUDITORIA.md`.

## Segurança

O sqlboard executa SQL contra bancos reais. Além das proteções da aplicação (somente leitura, timeout, limite de linhas, parâmetros sempre separados do SQL), **cadastre conexões com um usuário de banco que só tenha permissão de leitura (SELECT)**.
