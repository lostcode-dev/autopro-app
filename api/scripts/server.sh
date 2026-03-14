#!/usr/bin/env bash
set -euo pipefail

APP_NAME="second-brain-api"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
DEPLOY_ENV_FILE="$ROOT_DIR/.deploy.env"
RUNTIME_ENTRY="$ROOT_DIR/dist/server.cjs"

cd "$ROOT_DIR"

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
fi

current_log_file() {
  date +"%F"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Erro: comando '$command_name' não encontrado."
    exit 1
  fi
}

require_remote_config() {
  : "${DEPLOY_HOST:?Erro: defina DEPLOY_HOST no .deploy.env ou no ambiente}"
  : "${DEPLOY_USER:?Erro: defina DEPLOY_USER no .deploy.env ou no ambiente}"
  : "${DEPLOY_PATH:?Erro: defina DEPLOY_PATH no .deploy.env ou no ambiente}"
}

nginx_server_name() {
  printf '%s' "${NGINX_SERVER_NAME:-$DEPLOY_HOST}"
}

nginx_proxy_port() {
  printf '%s' "${NGINX_PROXY_PORT:-4000}"
}

remote_node_major() {
  printf '%s' "${REMOTE_NODE_MAJOR:-20}"
}

local_runtime_env_file() {
  printf '%s' "${DEPLOY_ENV_SOURCE:-$ROOT_DIR/.env.production}"
}

ssh_key_args() {
  if [[ -n "${DEPLOY_SSH_KEY_PATH:-}" ]]; then
    printf '%s' "-i $DEPLOY_SSH_KEY_PATH"
  fi
}

ssh_options() {
  local options=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
  if [[ -n "${DEPLOY_SSH_PORT:-}" ]]; then
    options+=( -p "$DEPLOY_SSH_PORT" )
  fi
  if [[ -n "${DEPLOY_SSH_KEY_PATH:-}" ]]; then
    options+=( -i "$DEPLOY_SSH_KEY_PATH" )
  fi
  printf '%q ' "${options[@]}"
}

rsync_ssh_command() {
  local command=(ssh)
  if [[ -n "${DEPLOY_SSH_PORT:-}" ]]; then
    command+=( -p "$DEPLOY_SSH_PORT" )
  fi
  if [[ -n "${DEPLOY_SSH_KEY_PATH:-}" ]]; then
    command+=( -i "$DEPLOY_SSH_KEY_PATH" )
  fi
  command+=( -o BatchMode=yes -o StrictHostKeyChecking=accept-new )
  printf '%q ' "${command[@]}"
}

remote_exec() {
  require_remote_config
  require_command ssh

  local remote_command="$1"
  local ssh_command="ssh $(ssh_options) ${DEPLOY_USER}@${DEPLOY_HOST}"
  eval "$ssh_command $(printf '%q' "$remote_command")"
}

sync_remote_files() {
  require_remote_config
  require_command rsync

  local rsync_command
  rsync_command="$(rsync_ssh_command)"

  echo "Sincronizando arquivos para ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}..."
  rsync -az --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude 'logs/' \
    --exclude '.env' \
    --exclude '.deploy.env' \
    --exclude 'scripts/keys/' \
    -e "$rsync_command" \
    "$ROOT_DIR/" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"
}

sync_remote_artifact() {
  require_remote_config
  require_command rsync

  local rsync_command
  rsync_command="$(rsync_ssh_command)"

  if [[ ! -f "$ROOT_DIR/dist/server.cjs" ]]; then
    echo "Erro: artefato não encontrado em dist/server.cjs. Rode o build local antes do deploy por artefato."
    exit 1
  fi

  echo "Sincronizando artefato de runtime para ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}..."
  rsync -az --delete \
    --include 'dist/' \
    --include 'dist/server.cjs' \
    --include 'scripts/' \
    --include 'scripts/server.sh' \
    --exclude '*' \
    -e "$rsync_command" \
    "$ROOT_DIR/" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"
}

sync_remote_env() {
  require_remote_config
  require_command rsync

  local rsync_command
  local env_source
  rsync_command="$(rsync_ssh_command)"
  env_source="$(local_runtime_env_file)"

  if [[ ! -f "$env_source" ]]; then
    echo "Erro: arquivo de ambiente de produção não encontrado em $env_source"
    echo "Crie esse arquivo localmente antes do deploy remoto."
    exit 1
  fi

  echo "Enviando arquivo de ambiente para ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.env..."
  rsync -az \
    -e "$rsync_command" \
    "$env_source" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.env"
}

remote_prepare_dir() {
  require_remote_config
  remote_exec "mkdir -p '$DEPLOY_PATH'"
}

remote_cleanup_artifact() {
  require_remote_config

  echo "Removendo arquivos antigos do deploy por artefato em ${DEPLOY_PATH}..."
  remote_exec "mkdir -p '$DEPLOY_PATH' && find '$DEPLOY_PATH' -mindepth 1 -maxdepth 1 ! -name '.env' ! -name 'logs' -exec rm -rf {} +"
}

remote_provision_runtime() {
  require_remote_config

  local node_major
  node_major="$(remote_node_major)"

  echo "Provisionando runtime remoto (Node.js ${node_major}, pnpm, PM2)..."

  remote_exec "export REMOTE_NODE_MAJOR='$node_major'; bash -se" <<'EOF'
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y curl ca-certificates gnupg build-essential

if ! command -v node >/dev/null 2>&1; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${REMOTE_NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@latest --activate
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
EOF
}

ensure_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "PM2 não encontrado. Instalando globalmente..."
    npm install -g pm2
  fi
}

ensure_env() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    echo "Arquivo .env não encontrado. Criando a partir de .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo "Preencha $ROOT_DIR/.env antes de subir em produção."
  fi
}

ensure_logs_dir() {
  mkdir -p "$LOG_DIR"
}

install_deps() {
  require_command pnpm
  echo "Instalando dependências..."

  local pnpm_args=(
    --reporter=append-only
    --fetch-retries 5
    --fetch-retry-factor 2
    --fetch-retry-mintimeout 1000
    --fetch-retry-maxtimeout 60000
    --fetch-timeout 120000
  )

  if [[ -f "$ROOT_DIR/pnpm-lock.yaml" ]]; then
    pnpm_args+=(--frozen-lockfile)
  else
    echo "Aviso: pnpm-lock.yaml não encontrado. Executando install sem frozen-lockfile."
    pnpm_args+=(--no-frozen-lockfile)
  fi

  local attempt
  for attempt in 1 2 3; do
    echo "Tentativa de install ${attempt}/3..."
    if pnpm install "${pnpm_args[@]}"; then
      echo "Dependências instaladas com sucesso."
      return
    fi

    if [[ "$attempt" -lt 3 ]]; then
      echo "Falha ao instalar dependências. Aguardando 5s para nova tentativa..."
      sleep 5
    fi
  done

  echo "Erro: não foi possível instalar dependências após 3 tentativas."
  exit 1
}

build_app() {
  require_command pnpm
  echo "Gerando build de produção..."
  pnpm build
}

build_artifact() {
  require_command pnpm
  echo "Gerando artefato local de runtime..."
  rm -rf "$ROOT_DIR/dist"
  pnpm build
}

start_app() {
  ensure_pm2
  ensure_logs_dir
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    echo "Aplicação já existe no PM2. Use restart ou deploy."
    exit 1
  fi
  echo "Iniciando aplicação no PM2..."
  NODE_ENV=production pm2 start node --name "$APP_NAME" --cwd "$ROOT_DIR" -- "$RUNTIME_ENTRY"
}

restart_app() {
  ensure_pm2
  ensure_logs_dir
  echo "Recriando aplicação no PM2 com a configuração atual..."
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 delete "$APP_NAME"
  fi

  NODE_ENV=production pm2 start node --name "$APP_NAME" --cwd "$ROOT_DIR" -- "$RUNTIME_ENTRY"
}

stop_app() {
  ensure_pm2
  echo "Parando aplicação no PM2..."
  pm2 stop "$APP_NAME"
}

delete_app() {
  ensure_pm2
  echo "Removendo aplicação do PM2..."
  pm2 delete "$APP_NAME"
}

show_status() {
  ensure_pm2
  pm2 status
}

show_logs() {
  ensure_logs_dir
  local target_date="${2:-$(current_log_file)}"
  local target_file="$LOG_DIR/$target_date.log"

  if [[ ! -f "$target_file" ]]; then
    echo "Log do dia $target_date não encontrado em $target_file"
    exit 1
  fi

  tail -f "$target_file"
}

list_logs() {
  ensure_logs_dir
  ls -1 "$LOG_DIR" | sort
}

save_pm2() {
  ensure_pm2
  pm2 save
}

bootstrap() {
  require_command node
  require_command npm
  require_command pnpm
  ensure_env
  install_deps
  build_app
  ensure_pm2
  ensure_logs_dir
  restart_app
  save_pm2
  echo "Bootstrap concluído."
  echo "Se ainda não configurou o startup do PM2 no servidor, rode: pm2 startup && pm2 save"
}

bootstrap_artifact() {
  require_command node
  require_command npm
  ensure_env
  ensure_logs_dir
  restart_app
  save_pm2
  echo "Bootstrap por artefato concluído."
}

deploy() {
  ensure_env
  install_deps
  build_app
  restart_app
  echo "Deploy concluído."
}

deploy_artifact() {
  ensure_env
  ensure_logs_dir
  restart_app
  echo "Deploy por artefato concluído."
}

remote_bootstrap() {
  remote_artifact_bootstrap
}

remote_deploy() {
  remote_artifact_deploy
}

remote_artifact_bootstrap() {
  require_remote_config
  build_artifact
  remote_provision_runtime
  remote_prepare_dir
  remote_cleanup_artifact
  sync_remote_artifact
  sync_remote_env
  remote_exec "cd '$DEPLOY_PATH' && chmod +x ./scripts/server.sh && ./scripts/server.sh bootstrap-artifact"
  echo "Bootstrap remoto por artefato concluído."
}

remote_artifact_deploy() {
  require_remote_config
  build_artifact
  remote_provision_runtime
  remote_prepare_dir
  remote_cleanup_artifact
  sync_remote_artifact
  sync_remote_env
  remote_exec "cd '$DEPLOY_PATH' && chmod +x ./scripts/server.sh && ./scripts/server.sh deploy-artifact"
  echo "Deploy remoto por artefato concluído."
}

remote_status() {
  require_remote_config
  remote_exec "cd '$DEPLOY_PATH' && ./scripts/server.sh status"
}

remote_logs() {
  require_remote_config
  local target_date="${2:-$(current_log_file)}"
  remote_exec "cd '$DEPLOY_PATH' && ./scripts/server.sh logs '$target_date'"
}

remote_nginx_setup() {
  require_remote_config

  local server_name
  local proxy_port
  server_name="$(nginx_server_name)"
  proxy_port="$(nginx_proxy_port)"

  remote_exec "export SERVER_NAME='$server_name' PROXY_PORT='$proxy_port'; bash -se" <<'EOF'
set -euo pipefail

apt-get update
apt-get install -y nginx

cat > /etc/nginx/sites-available/second-brain-api <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name ${SERVER_NAME};

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:${PROXY_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_read_timeout 60s;
  }
}
NGINX

ln -sfn /etc/nginx/sites-available/second-brain-api /etc/nginx/sites-enabled/second-brain-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' || true
fi
EOF

  echo "Nginx remoto configurado para proxy em http://$(nginx_server_name) -> 127.0.0.1:$(nginx_proxy_port)"
}

remote_nginx_test() {
  require_remote_config
  remote_exec "nginx -t && systemctl status nginx --no-pager"
}

usage() {
  cat <<'EOF'
Uso: ./scripts/server.sh <comando>

Comandos:
  bootstrap   Primeira subida: valida ambiente, instala deps, builda e sobe com PM2
  deploy      Atualiza dependências, gera novo build e reinicia no PM2
  bootstrap-artifact  Sobe no PM2 usando apenas o artefato já buildado
  deploy-artifact     Atualiza no PM2 usando apenas o artefato já buildado
  remote-bootstrap  Fluxo padrão: builda localmente e sobe só o runtime no servidor
  remote-deploy     Fluxo padrão: builda localmente e envia só o runtime no servidor
  remote-artifact-bootstrap  Builda localmente e envia só o runtime para o servidor
  remote-artifact-deploy     Builda localmente e envia só o runtime para o servidor
  remote-provision  Instala Node.js, pnpm e PM2 no servidor remoto
  remote-status     Consulta status da app no servidor remoto
  remote-logs       Acompanha log diário remoto (ou outro dia: remote-logs YYYY-MM-DD)
  remote-nginx-setup Instala/configura Nginx remoto para expor a API
  remote-nginx-test  Valida a config e o status do Nginx remoto
  install     Instala dependências com pnpm
  build       Gera build de produção
  start       Sobe a aplicação no PM2
  restart     Reinicia a aplicação no PM2
  stop        Para a aplicação no PM2
  delete      Remove a aplicação do PM2
  status      Mostra status no PM2
  logs        Acompanha o log diário atual (ou outro dia: logs YYYY-MM-DD)
  list-logs   Lista os arquivos de log disponíveis
  save        Salva o estado atual do PM2
EOF
}

COMMAND="${1:-}"

case "$COMMAND" in
  bootstrap) bootstrap ;;
  deploy) deploy ;;
  bootstrap-artifact) bootstrap_artifact ;;
  deploy-artifact) deploy_artifact ;;
  remote-bootstrap) remote_bootstrap ;;
  remote-deploy) remote_deploy ;;
  remote-artifact-bootstrap) remote_artifact_bootstrap ;;
  remote-artifact-deploy) remote_artifact_deploy ;;
  remote-provision) remote_provision_runtime ;;
  remote-status) remote_status ;;
  remote-logs) remote_logs "$@" ;;
  remote-nginx-setup) remote_nginx_setup ;;
  remote-nginx-test) remote_nginx_test ;;
  install) install_deps ;;
  build) build_app ;;
  start) start_app ;;
  restart) restart_app ;;
  stop) stop_app ;;
  delete) delete_app ;;
  status) show_status ;;
  logs) show_logs "$@" ;;
  list-logs) list_logs ;;
  save) save_pm2 ;;
  *) usage; exit 1 ;;
esac
