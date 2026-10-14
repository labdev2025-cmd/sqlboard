# Guia de deploy do sqlboard

Este guia cobre a instalação para uma equipe: imagem Docker de produção, variáveis de ambiente, banco de metadados, HTTPS, e-mail, agentes MCP, rotação de chaves, backup e atualização.

## 1. O que você precisa

- **Docker** (ou Node 22 + pnpm, se preferir rodar sem contêiner).
- **PostgreSQL 16+** para os metadados do sqlboard (usuários, conexões, telas, auditoria). Pode ser o do `compose.yaml` ou um gerenciado.
- Um **domínio com HTTPS** na frente da aplicação (proxy reverso ou balanceador).
- Opcional: um servidor **SMTP** para os agendamentos.

## 2. Subir com Docker Compose

```bash
cp .env.example .env
# Edite .env: gere os segredos abaixo e ajuste BETTER_AUTH_URL.
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # SQLBOARD_ENCRYPTION_KEY
docker compose --profile app up -d --build
```

A aplicação sobe em `http://localhost:3000`. Na primeira visita, a tela de cadastro cria o **primeiro administrador**; depois disso o cadastro público fica fechado e só administradores criam contas.

O contêiner:

- roda como usuário sem privilégios (`sqlboard`);
- aplica as migrações do banco de metadados ao iniciar (`SQLBOARD_MIGRATE_ON_BOOT=on`);
- expõe `GET /api/health` e tem `HEALTHCHECK` próprio;
- guarda arquivos em dois volumes: `/app/data` (bancos SQLite) e `/app/.data` (caixa de saída de e-mail sem SMTP).

### Só a imagem

```bash
docker build -t sqlboard .
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgres://usuario:senha@host:5432/sqlboard \
  -e BETTER_AUTH_URL=https://sqlboard.exemplo.com \
  -e BETTER_AUTH_SECRET=... \
  -e SQLBOARD_ENCRYPTION_KEY=... \
  -v sqlboard-data:/app/data -v sqlboard-outbox:/app/.data \
  sqlboard
```

O CI constrói essa imagem a cada push e confere que ela sobe, migra o banco e responde (job `docker` em `.github/workflows/ci.yml`).

## 3. Variáveis de ambiente

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | PostgreSQL dos metadados. |
| `BETTER_AUTH_SECRET` | sim | Assina as sessões. 32 bytes aleatórios. |
| `BETTER_AUTH_URL` | sim | URL pública (com `https://`). Usada nos cookies, nos links dos e-mails e no endereço MCP. |
| `SQLBOARD_ENCRYPTION_KEY` | sim | Chave AES-256-GCM das senhas de conexão (32 bytes em base64). **Guarde fora do servidor**: sem ela as senhas cadastradas ficam ilegíveis. |
| `SQLBOARD_ENCRYPTION_KEY_VERSION` | não (1) | Versão da chave atual; incremente ao rotacionar. |
| `SQLBOARD_ENCRYPTION_OLD_KEYS` | não | Chaves antigas durante a rotação: `versão:base64,versão:base64`. |
| `SMTP_URL` / `SMTP_FROM` | não | Envio dos agendamentos. Sem `SMTP_URL`, os e-mails vão para a caixa de saída local. |
| `SQLBOARD_MAIL_ALLOWED_DOMAINS` | não | Limita destinatários a domínios (ex.: `empresa.com`). Recomendado. |
| `SQLBOARD_OUTBOX_DIR` | não | Pasta da caixa de saída (imagem: `/app/.data/outbox`). |
| `SQLBOARD_SQLITE_DIR` | não | Única pasta de onde conexões SQLite podem abrir arquivos (imagem: `/app/data/sqlite`). |
| `SQLBOARD_SCHEDULER` | não | `off` desliga o agendador interno. |
| `SQLBOARD_MIGRATE_ON_BOOT` | não | `on` na imagem; desligue se preferir migrar à parte (`pnpm db:migrate`). |
| `SQLBOARD_IP_HEADERS` | não (`x-forwarded-for`) | Cabeçalho com o IP do cliente que o proxy **sobrescreve** (ex.: `x-real-ip`, `cf-connecting-ip`). Usado no limite de tentativas de login. |
| `SQLBOARD_TRUSTED_PROXIES` | não | IPs/CIDRs dos proxies confiáveis, para ler uma cadeia `X-Forwarded-For`. |
| `SQLBOARD_AUTH_RATE_LIMIT` | não | `off` só em testes automatizados. **Nunca** em produção. |

## 4. HTTPS e proxy reverso

Coloque o sqlboard atrás de um proxy com TLS (Nginx, Caddy, Traefik ou o balanceador da nuvem) e defina `BETTER_AUTH_URL` com o endereço `https://` final. Exemplo com Caddy:

```text
sqlboard.exemplo.com {
  reverse_proxy localhost:3000
}
```

Repasse os cabeçalhos `Host` e `X-Forwarded-*` (padrão no Caddy). As respostas já saem com `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` e `Referrer-Policy`.

O limite de tentativas de login (10 por minuto por IP e 20 a cada 15 minutos por conta, guardado no banco) depende do IP real do cliente. Garanta que só o proxy alcança a porta 3000 e configure `SQLBOARD_IP_HEADERS` com o cabeçalho que ele sobrescreve (ou `SQLBOARD_TRUSTED_PROXIES` com os endereços dele). Sem isso, um cliente pode forjar o cabeçalho e escapar do limite por IP (o limite por conta continua valendo).

## 5. Conexões com bancos da empresa

- Cadastre cada conexão com um **usuário de banco só com leitura** (`SELECT`). O sqlboard também força transação somente leitura, tempo limite e limite de linhas, mas a permissão do banco é a defesa principal. Veja a tabela de capacidades no README.
- **Ações de escrita** usam uma conexão separada com uso “Escrita controlada”: dê a esse usuário só `INSERT`/`UPDATE` nas tabelas necessárias.
- O servidor do sqlboard precisa alcançar os bancos pela rede; libere só o IP dele no firewall dos bancos.
- SQLite: copie os arquivos para o volume `/app/data/sqlite` e cadastre só o nome do arquivo.

## 6. E-mail e agendamentos

O agendador roda dentro da aplicação a cada 30 segundos. Com várias réplicas, cada agendamento roda uma única vez por janela (o banco trava a linha com `FOR UPDATE SKIP LOCKED`). Cada execução usa as permissões **atuais** do dono: se ele perder o acesso ou for desativado, o envio falha e o erro aparece em `/schedules`.

## 7. Agentes (MCP) e scripts

- Cada pessoa cria tokens em **Tokens de API** (menu do usuário). O token tem o mesmo papel e os mesmos acessos da pessoa, validade de 30, 90 ou 365 dias (ou sem validade, se escolhido) e pode ser revogado a qualquer momento. O banco guarda só o hash.
- Endereço MCP: `https://sqlboard.exemplo.com/api/mcp` com `Authorization: Bearer <token>`. Agentes criam e editam **rascunhos**; publicar é sempre uma ação humana na tela.
- Tokens não acessam rotas de administração nem criam outros tokens.
- Versionamento em git: `SQLBOARD_URL=… SQLBOARD_TOKEN=… pnpm apps:pull telas/` baixa cada tela editável como JSON estável; `pnpm apps:push telas/` envia as mudanças como rascunho.

## 8. Rotação da chave de criptografia

1. Gere a nova chave e configure: `SQLBOARD_ENCRYPTION_KEY=<nova>`, `SQLBOARD_ENCRYPTION_KEY_VERSION=2`, `SQLBOARD_ENCRYPTION_OLD_KEYS=1:<antiga>`.
2. Reinicie a aplicação e rode `pnpm keys:rotate` (ou `docker compose run --rm app node …` com o mesmo ambiente) para recifrar as senhas.
3. Remova a chave antiga de `SQLBOARD_ENCRYPTION_OLD_KEYS` e reinicie.

## 9. Backup e atualização

- **Backup:** `pg_dump` diário do banco de metadados e cópia do volume `/app/data`. Guarde `SQLBOARD_ENCRYPTION_KEY` separadamente (cofre de segredos), nunca junto do dump.
- **Atualização:** `git pull && docker compose --profile app up -d --build`. As migrações rodam no início; telas salvas em versões antigas do documento são convertidas automaticamente ao abrir.

## 10. Limites de uma réplica e de várias

Funciona bem com **uma réplica**. Com várias, tudo continua correto, com estas ressalvas:

- o cache de resultados é por processo (uma réplica pode reexecutar uma query que outra já tinha em cache);
- o limite de tentativas de login fica no banco e já vale para todas as réplicas;
- o cancelamento de uma execução precisa chegar à réplica que a está rodando (use afinidade de sessão no balanceador);
- o token de prévia das ações de escrita é de uso único por processo; com várias réplicas, prefira afinidade de sessão.

## Checklist de produção

- [ ] `BETTER_AUTH_URL` com `https://` e proxy com TLS.
- [ ] Segredos gerados aleatoriamente e guardados num cofre; `.env` fora do git.
- [ ] Usuários de banco só com leitura nas conexões de leitura.
- [ ] `SQLBOARD_MAIL_ALLOWED_DOMAINS` definido.
- [ ] Porta 3000 acessível só pelo proxy; `SQLBOARD_IP_HEADERS` (ou `SQLBOARD_TRUSTED_PROXIES`) configurado.
- [ ] Logins de SQL Server só com `db_datareader`; usuários MySQL sem o privilégio `FILE`.
- [ ] Backup do PostgreSQL e do volume `/app/data` testado.
- [ ] Primeiro administrador criado logo após o deploy.
