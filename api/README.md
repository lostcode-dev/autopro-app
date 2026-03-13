# Second Brain — API

API backend standalone (Express + TypeScript) com cron jobs internos via `node-cron`, integrada ao Supabase. Roda como processo persistente, com logs diários em arquivo e retenção automática dos últimos 30 dias.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Linguagem**: TypeScript (strict)
- **Banco**: Supabase (via service role key, server-side only)
- **Cron**: node-cron (in-process, timezone-aware)
- **Validação**: Zod
- **Lint/Format**: ESLint 9 + Prettier

## Estrutura

```
src/
├── config/        # Validação de env com Zod
├── controllers/   # Handlers das rotas HTTP
├── jobs/          # Cron jobs (scheduler + job functions)
│   ├── scheduler.ts       # Registra e inicia todos os cron jobs
│   └── close-day.job.ts   # Job de fechamento do dia (com lock guard)
├── lib/           # Clients externos (Supabase)
├── middlewares/    # Error handler, request logger
├── repositories/  # Acesso a dados (Supabase queries)
├── routes/        # Definição das rotas Express
├── services/      # Lógica de negócio
├── types/         # Interfaces e enums
├── utils/         # Utilitários (datas, logger)
├── app.ts         # Setup do Express
└── server.ts      # Entrypoint (inicia Express + scheduler)
```

## Setup

```bash
cd api
cp .env.example .env   # preencha as variáveis
pnpm install
pnpm dev               # tsx watch mode (cron jobs ativos)
```

## Variáveis de ambiente

| Variável                    | Descrição                                      | Default         |
| --------------------------- | ---------------------------------------------- | --------------- |
| `PORT`                      | Porta do servidor                              | `4000`          |
| `NODE_ENV`                  | `development` \| `production` \| `test`        | `development`   |
| `SUPABASE_URL`              | URL do projeto Supabase                        |                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (nunca expor no client)        |                 |
| `TZ`                        | Timezone IANA para os cron jobs                 | `Europe/Lisbon` |
| `CRON_CLOSE_DAY_SCHEDULE`   | Expressão cron para o job de fechamento do dia  | `55 23 * * *`   |

## Cron Jobs

### close-day

Roda diariamente às 23:55 (configurável via `CRON_CLOSE_DAY_SCHEDULE`) no timezone definido em `TZ`.

**O que faz:**
- Processa o dia anterior + os últimos 7 dias (backfill automático)
- Para cada dia, busca hábitos que estavam ativos naquela data (via `habit_versions`)
- Filtra hábitos arquivados antes da data
- Verifica quais hábitos não têm log registrado
- Insere log com `status: skipped` e `completed: false` para os que ficaram sem registro
- Idempotente: usa `upsert` com `onConflict: habit_id,log_date` — nunca sobrescreve logs existentes
- Lock guard: se o job anterior ainda está rodando, a nova execução é ignorada

**Backfill automático:** Cada execução processa os últimos 7 dias por padrão, garantindo que dias perdidos (reinício do servidor, deploy, etc.) sejam cobertos automaticamente.

## Endpoints HTTP

### Página de teste no navegador

```
GET /
```

Abre uma página HTML simples confirmando que a API está online.

Exemplos:

```bash
http://localhost:4000/
http://104.248.94.247/
```

### Health

```
GET /api/health
```

### Webhooks

```
POST /api/webhooks/example
```

Endpoint de exemplo para receber payloads externos.

## Scripts

| Comando          | Descrição                        |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Dev server com hot reload (tsx)  |
| `pnpm build`     | Compila para `dist/`             |
| `pnpm start`     | Roda build de produção           |
| `pnpm server:bootstrap` | Primeira subida no servidor com PM2 |
| `pnpm server:deploy` | Deploy de manutenção com restart |
| `pnpm server:remote-bootstrap` | Envia arquivos e faz bootstrap remoto via SSH |
| `pnpm server:remote-deploy` | Envia arquivos e faz deploy remoto via SSH |
| `pnpm server:remote-provision` | Provisiona Node.js, pnpm e PM2 no servidor remoto |
| `pnpm server:remote-nginx-setup` | Instala e configura Nginx remoto para expor a API |
| `pnpm server:remote-nginx-test` | Testa a configuração remota do Nginx |
| `pnpm server:remote-status` | Consulta o status remoto via SSH |
| `pnpm server:remote-logs` | Acompanha o log remoto do dia atual |
| `pnpm server:start` | Sobe a app no PM2 |
| `pnpm server:restart` | Reinicia a app no PM2 |
| `pnpm server:stop` | Para a app no PM2 |
| `pnpm server:status` | Mostra status no PM2 |
| `pnpm server:logs` | Acompanha o log diário atual |
| `pnpm server:list-logs` | Lista os arquivos de log disponíveis |
| `pnpm lint`      | ESLint                           |
| `pnpm lint:fix`  | ESLint com auto-fix              |
| `pnpm format`    | Prettier                         |

## Script operacional do servidor

Foi criado o script [scripts/server.sh](/home/daniel-soares/personal_projects/second-brain/api/scripts/server.sh) para simplificar tanto a primeira implantação quanto a manutenção futura.

Ele também suporta deploy remoto via SSH/rsync, para você rodar a partir da sua máquina local sem entrar manualmente no servidor em cada deploy.

### Configuração do deploy remoto

Crie um arquivo `.deploy.env` na raiz de `api/` a partir deste modelo:

```bash
DEPLOY_HOST=104.248.94.247
DEPLOY_USER=root
DEPLOY_PATH=/var/www/second-brain/api

# Opcional
DEPLOY_SSH_PORT=22
DEPLOY_SSH_KEY_PATH=/home/seu-usuario/.ssh/id_ed25519

# Nginx
NGINX_SERVER_NAME=104.248.94.247
NGINX_PROXY_PORT=4000

# Runtime remoto
REMOTE_NODE_MAJOR=20
```

Esse arquivo fica fora do Git.

### Primeira vez no servidor

```bash
cd /caminho/para/second-brain/api
chmod +x ./scripts/server.sh
./scripts/server.sh bootstrap
```

O comando `bootstrap` faz:

- garante que `.env` exista
- instala dependências com `pnpm install --frozen-lockfile`
- gera o build de produção
- instala o PM2 globalmente se necessário
- sobe ou reinicia a aplicação no PM2
- salva o estado do PM2

### Primeira vez a partir da sua máquina local

```bash
cd /caminho/para/second-brain/api
pnpm server:remote-bootstrap
```

Esse comando:

- provisiona Node.js, pnpm e PM2 no Droplet se ainda não existirem
- cria o diretório remoto se necessário
- envia os arquivos com `rsync`
- exclui do envio `node_modules`, `dist`, `logs`, `.env`, `.deploy.env` e `scripts/keys`
- executa `./scripts/server.sh bootstrap` no servidor

Se quiser provisionar o runtime antes, isoladamente:

```bash
pnpm server:remote-provision
```

### Manutenção futura

Depois de atualizar o código no servidor:

```bash
cd /caminho/para/second-brain/api
./scripts/server.sh deploy
```

O comando `deploy` faz:

- reinstala dependências
- gera novo build
- reinicia a aplicação no PM2

### Manutenção futura a partir da sua máquina local

```bash
cd /caminho/para/second-brain/api
pnpm server:remote-deploy
```

Comandos remotos adicionais:

```bash
pnpm server:remote-status
pnpm server:remote-logs
pnpm server:remote-logs -- 2026-03-13
pnpm server:remote-provision
pnpm server:remote-nginx-setup
pnpm server:remote-nginx-test
```

### Expor a API para testes externos com Nginx

Para publicar a API externamente via IP do Droplet, rode:

```bash
pnpm server:remote-nginx-setup
```

Isso instala e configura o Nginx no servidor remoto com proxy reverso para `127.0.0.1:4000` e remove o site default.

Depois valide:

```bash
pnpm server:remote-nginx-test
curl http://104.248.94.247/
curl http://104.248.94.247/api/health
```

Configuração aplicada:

- `server_name`: valor de `NGINX_SERVER_NAME` ou `DEPLOY_HOST`
- `proxy_pass`: `http://127.0.0.1:NGINX_PROXY_PORT`
- endpoint esperado de teste: `http://SEU_IP/api/health`

Se depois você apontar um domínio, basta trocar `NGINX_SERVER_NAME` e reexecutar `pnpm server:remote-nginx-setup`.

### Comandos úteis

```bash
./scripts/server.sh status
./scripts/server.sh logs
./scripts/server.sh logs 2026-03-13
./scripts/server.sh list-logs
./scripts/server.sh restart
./scripts/server.sh stop
./scripts/server.sh delete
```

### Política de logs

- Os logs são gravados em `logs/YYYY-MM-DD.log`
- A aplicação mantém automaticamente apenas os últimos 30 arquivos diários
- A limpeza acontece na inicialização e também quando um novo dia começa a gerar logs
- O PM2 não grava logs próprios em arquivo, evitando duplicação e crescimento fora da política de retenção

## Deploy em produção com PM2

### Instalação

```bash
npm install -g pm2
```

### Configuração (ecosystem.config.cjs)

O arquivo [ecosystem.config.cjs](/home/daniel-soares/personal_projects/second-brain/api/ecosystem.config.cjs) já foi criado na raiz de `api/`:

```js
module.exports = {
  apps: [{
    name: 'second-brain-api',
    script: 'dist/server.js',
    instances: 1,            // ⚠️ IMPORTANTE: apenas 1 instância
    exec_mode: 'fork',       // fork, NÃO cluster
    env: {
      NODE_ENV: 'production',
    },
    // Logs da aplicação são geridos pelo logger interno
    error_file: '/dev/null',
    out_file: '/dev/null',
    merge_logs: true,
    // Restart automático
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }]
}
```

### Comandos

```bash
# Build primeiro
pnpm build

# Iniciar
pm2 start ecosystem.config.cjs

# Ver status
pm2 status

# Ver logs do dia atual
./scripts/server.sh logs

# Ver logs de um dia específico
./scripts/server.sh logs 2026-03-13

# Restart
pm2 restart second-brain-api

# Parar
pm2 stop second-brain-api

# Salvar configuração para iniciar no boot do sistema
pm2 save
pm2 startup
```

### Cuidados importantes

1. **Apenas 1 instância**: Nunca use `instances: 2+` ou `exec_mode: 'cluster'` — isso criaria múltiplos cron jobs rodando em paralelo, duplicando os logs de skip.

2. **Cron jobs iniciam automaticamente**: O scheduler é registrado no `server.ts` assim que o servidor liga. Não precisa de configuração extra.

3. **Graceful shutdown**: O servidor escuta `SIGTERM` e `SIGINT` para parar os cron jobs antes de encerrar. O PM2 envia `SIGTERM` automaticamente ao parar/reiniciar.

4. **Idempotência garante segurança**: Mesmo se o processo reiniciar no meio de uma execução, na próxima rodada o job reprocessa os mesmos dias sem duplicar dados (graças ao `upsert` com `onConflict`).

5. **Backfill automático**: Se o servidor ficar offline por alguns dias, ao reiniciar o job automaticamente cobre os últimos 7 dias. Para gaps maiores, aumente `BACKFILL_DAYS` na service.

6. **Chave SSH**: Não mantenha chave privada dentro do repositório. Prefira usar uma chave em `~/.ssh/` ou via ssh-agent. Se alguma chave privada já foi salva dentro do projeto, o correto é removê-la do repositório e rotacioná-la.

7. **Teste externo**: Com Nginx ativo, você consegue chamar a API de fora pelo IP do Droplet, por exemplo `http://104.248.94.247/api/health`.
