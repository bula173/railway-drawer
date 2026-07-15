#!/bin/bash

# Quick Deploy Script - Minimal version
# Usage: ./quick-deploy.sh [server_host] [server_user] [server_path]

SERVER_HOST="${1:-192.168.10.22}"
SERVER_USER="${2:-root}"
SERVER_PATH="${3:-/var/www/html}"

echo "🚀 Building and deploying Railway Drawer..."

# Install dependencies first
echo "📦 Installing dependencies..."
npm install || npm install --legacy-peer-deps || { echo "❌ Dependency install failed"; exit 1; }

# Build
echo "📦 Building..."
npm run build || { echo "❌ Build failed"; exit 1; }

# Deploy
echo "📤 Deploying to ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/railway-drawer..."
scp -r dist "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/railway-drawer" || { echo "❌ Deploy failed"; exit 1; }

echo "✅ Done! Access at http://${SERVER_HOST}/railway-drawer/"
