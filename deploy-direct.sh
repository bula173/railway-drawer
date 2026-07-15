#!/bin/bash

# Direct Deployment Script - Deploy to /var/www/html
# The built files go directly into /var/www/html (not in a subfolder)

set -e

SERVER_HOST="${1:-192.168.10.22}"
SERVER_USER="${2:-root}"
SERVER_PATH="${3:-/var/www/html}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}Railway Drawer - Direct Deploy${NC}"
echo -e "${YELLOW}=====================================${NC}"

# Build
echo -e "\n${YELLOW}📦 Building...${NC}"
npm install --legacy-peer-deps 2>&1 | grep -E "added|up to date" || true
npm run build || { echo -e "${RED}❌ Build failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Build successful${NC}"

# Deploy directly to server root
echo -e "\n${YELLOW}📤 Deploying to ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}${NC}"

# Copy all files from dist/ directly to /var/www/html/
scp -r dist/* "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/" || { echo -e "${RED}❌ Deploy failed${NC}"; exit 1; }

echo -e "${GREEN}✓ Deployed!${NC}"
echo -e "\n${YELLOW}=====================================${NC}"
echo -e "${GREEN}✓ Done!${NC}"
echo -e "${YELLOW}Access at: http://${SERVER_HOST}/${NC}"
echo -e "${YELLOW}=====================================${NC}"
