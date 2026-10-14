---
name: Ordenar int8/numeric convertendo para number perde precisão
description: Valores acima de 2^53 que chegam como texto viram o mesmo number do JavaScript; a ordenação da tabela compara o texto decimal de forma exata.
type: project
category: bug
date: 2026-10-14
---
`int8` e `numeric` chegam do driver como texto para preservar a precisão (PROMPT.md §4.2.5), mas a ordenação da tabela fazia `Number(texto)`: "9007199254740993" e "9007199254740992" ficavam iguais.

**Problema/Contexto:** achado por teste novo de `compareCells` (`lib/format.ts`) na auditoria de 2026-10-14.
**Por que importa:** IDs e somas grandes aparecem fora de ordem sem nenhum erro visível.
**Como aplicar:** compare números textuais com `compareDecimalStrings` (sinal, parte inteira por tamanho, depois dígitos); só use `Number` quando o texto não for decimal simples. Vale para qualquer novo ponto que ordene, agrupe ou compare valores numéricos vindos do banco (gráficos, KPIs, comparação de resultados).
**Evidência:** `tests/unit/layout-format.test.ts` ("int8 acima de 2^53").
