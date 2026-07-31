#!/usr/bin/env bash
# Deploy na VPS — rode na pasta do projeto ou ajuste APP_DIR abaixo.
# Uso: bash deploy.sh
#  ou: chmod +x deploy.sh && ./deploy.sh

set -euo pipefail

# >>> AJUSTE ESTE CAMINHO SE PRECISAR <<<
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
APP_NAME="${APP_NAME:-paulo}"

cd "$APP_DIR"

echo "==> Diretório: $APP_DIR"
echo "==> git pull"
git pull

echo "==> npm i"
npm i

echo "==> npm run css"
npm run css || echo "==> CSS: falhou ou pulado; usando public/css/output.css do repo"

# Reinicia com PM2 (recomendado na VPS)
if command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 restart: $APP_NAME"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
  else
    pm2 start server.js --name "$APP_NAME"
    pm2 save
  fi
  pm2 status "$APP_NAME"
else
  echo "==> PM2 não encontrado. Subindo com npm start (encerra ao fechar o terminal)."
  echo "    Instale: npm i -g pm2 && pm2 start server.js --name $APP_NAME && pm2 save && pm2 startup"
  npm start
fi

echo "==> Deploy ok."
