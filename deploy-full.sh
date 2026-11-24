#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./deploy-full.sh [deployment-directory]

Create a Docker Compose deployment for wardpearce/materialious-full and start it.
The default directory is ~/materialious-full. Existing configuration is never
overwritten. Run this script from a terminal to answer the setup prompts.
EOF
}

if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  usage
  exit 0
fi
if (( $# > 1 )); then
  usage >&2
  exit 2
fi

deploy_dir=${1:-"$HOME/materialious-full"}
compose_file="$deploy_dir/compose.yaml"
env_file="$deploy_dir/.env"

for command in docker openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command" >&2
    exit 1
  fi
done
if ! docker compose version >/dev/null 2>&1; then
  printf 'Docker Compose is required (docker compose).\n' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  printf 'Cannot reach the Docker daemon. Start Docker and check your permissions.\n' >&2
  exit 1
fi
if [[ -e $compose_file || -e $env_file ]]; then
  printf 'Configuration already exists in %s; refusing to overwrite it.\n' "$deploy_dir" >&2
  exit 1
fi

input_fd=0
if [[ ! -t 0 ]] && { exec 3</dev/tty; } 2>/dev/null; then
  input_fd=3
fi

ask() {
  local label=$1 default=$2 answer
  printf '%s [%s]: ' "$label" "$default" >&2
  if ! IFS= read -r answer <&"$input_fd"; then
    printf '\nInput ended before setup was complete.\n' >&2
    exit 1
  fi
  REPLY=${answer:-$default}
}

ask_bool() {
  local label=$1 default=$2
  while true; do
    ask "$label (yes/no)" "$default"
    case ${REPLY,,} in
      y | yes) REPLY=true; return ;;
      n | no) REPLY=false; return ;;
      *) printf 'Please answer yes or no.\n' >&2 ;;
    esac
  done
}

valid_url() {
  [[ $1 =~ ^https?://[^/?#[:space:]]+$ ]] &&
    [[ $1 != *'$'* && $1 != *'"'* && $1 != *"'"* && $1 != *'\'* ]]
}

printf 'Materialious full deployment\n' >&2
ask 'Host port' '3000'
port=$REPLY
if [[ ! $port =~ ^[0-9]+$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then
  printf 'Host port must be between 1 and 65535.\n' >&2
  exit 1
fi

ask 'Public origin (exact URL used in the browser)' "http://localhost:$port"
origin=$REPLY
if ! valid_url "$origin"; then
  printf 'Public origin must be an http(s) URL with a host and no path or trailing slash.\n' >&2
  exit 1
fi

ask 'Invidious instance URL (leave blank for public API)' ''
invidious=$REPLY
if [[ -n $invidious ]] && ! valid_url "$invidious"; then
  printf 'Invidious instance must be an http(s) URL with no path or trailing slash.\n' >&2
  exit 1
fi

ask_bool 'Enable built-in accounts' 'yes'
internal_auth=$REPLY

proxy_auth_default=yes
if [[ $internal_auth == false ]]; then
  proxy_auth_default=no
fi
while true; do
  ask_bool 'Require login to use the server proxy' "$proxy_auth_default"
  require_auth=$REPLY
  if [[ $internal_auth == false && $require_auth == true ]]; then
    printf 'Proxy authentication requires built-in accounts. Choose no.\n' >&2
    continue
  fi
  break
done

admin_username=
registration_allowed=false
if [[ $internal_auth == true ]]; then
  registration_allowed=true
  ask 'Admin username to register first (optional)' ''
  admin_username=$REPLY
  if [[ -n $admin_username && ! $admin_username =~ ^[a-zA-Z0-9_.-]+$ ]]; then
    printf 'Admin username may contain only letters, numbers, _, ., and -.\n' >&2
    exit 1
  fi
fi

captcha_disabled=false
if [[ $origin == http://* ]]; then
  captcha_disabled=true
fi
cookie_secret=$(openssl rand -hex 32)

umask 077
mkdir -p "$deploy_dir"
cat > "$env_file" <<EOF
# Edit this file to change Materialious settings, then run docker compose up -d.
MATERIALIOUS_PORT=$port
ORIGIN=$origin
COOKIE_SECRET=$cookie_secret
DATABASE_CONNECTION_URI=sqlite:///materialious-data/materialious.db
PUBLIC_INTERNAL_AUTH=$internal_auth
PUBLIC_REQUIRE_AUTH=$require_auth
# If accounts are enabled, registration is open for the first account. Close it afterward.
PUBLIC_REGISTRATION_ALLOWED=$registration_allowed
PUBLIC_ADMIN_USERNAMES=$admin_username
PUBLIC_CAPTCHA_DISABLED=$captcha_disabled
PUBLIC_DEFAULT_INVIDIOUS_INSTANCE=$invidious
EOF

cat > "$compose_file" <<'EOF'
services:
  materialious:
    image: wardpearce/materialious-full:latest
    restart: unless-stopped
    ports:
      - "${MATERIALIOUS_PORT:-3000}:3000"
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    volumes:
      - materialious-data:/materialious-data

volumes:
  materialious-data:
EOF

printf 'Created %s and %s\n' "$compose_file" "$env_file" >&2
if ! (cd "$deploy_dir" && docker compose config -q && docker compose up -d); then
  printf 'Deployment failed. Your configuration is saved in %s.\n' "$deploy_dir" >&2
  exit 1
fi

printf '\nMaterialious is starting at %s\n' "$origin"
if [[ $internal_auth == true ]]; then
  printf 'Register your first account, then set PUBLIC_REGISTRATION_ALLOWED=false in %s\n' "$env_file"
  printf 'and run: cd %q && docker compose up -d\n' "$deploy_dir"
  if [[ -n $admin_username ]]; then
    printf 'Register with username %s to receive admin privileges.\n' "$admin_username"
  fi
fi
