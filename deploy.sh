#!/bin/bash

# Railway Drawer LAN deployment
# Builds the project and deploys it to root@192.168.0.22:/var/www/html/railway-drawer
# (served at http://192.168.0.22/railway-drawer/). Production is deployed separately by
# Cloudflare Workers Builds on push (wrangler.jsonc).

set -e  # Exit on error

# Configuration
SERVER_HOST="${SERVER_HOST:-192.168.0.22}"  # override: SERVER_HOST=<ip> ./deploy.sh
SERVER_USER="root"
SERVER_PATH="/var/www/html"
BUILD_DIR="dist"
BUILD_NAME="railway-drawer"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}Railway Drawer Deployment Script${NC}"
echo -e "${YELLOW}=====================================${NC}"

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Clean previous build
echo -e "\n${YELLOW}Step 1: Cleaning previous builds...${NC}"
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✓ Old build cleaned${NC}"
else
    echo -e "${GREEN}✓ No previous build found${NC}"
fi

# Step 2: Install dependencies
echo -e "\n${YELLOW}Step 2: Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 3: Build project
echo -e "\n${YELLOW}Step 3: Building project...${NC}"
# The build script uses `vite build --base ./`: the same build is served at /railway-drawer/ (LAN)
# and at / (Cloudflare)
npm run build
if [ -f "$BUILD_DIR/index.html" ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
    echo -e "${GREEN}  Build directory: $BUILD_DIR${NC}"
    echo -e "${GREEN}  Build size: $(du -sh "$BUILD_DIR" | cut -f1)${NC}"
else
    echo -e "${RED}Build failed - $BUILD_DIR/index.html not found${NC}"
    exit 1
fi

# Step 4: Check server
echo -e "\n${YELLOW}Step 4: Checking server...${NC}"
echo -e "${YELLOW}  Server: ${SERVER_USER}@${SERVER_HOST}${NC}"
echo -e "${YELLOW}  Path: ${SERVER_PATH}/${BUILD_NAME}${NC}"

if ! ssh -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_HOST}" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${RED}Cannot connect to server${NC}"
    echo -e "${RED}  Check: ssh ${SERVER_USER}@${SERVER_HOST}${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection OK${NC}"

# Step 5: Back up the deployed build (timestamp taken locally)
BACKUP_NAME="${BUILD_NAME}.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "\n${YELLOW}Step 5: Creating backup on server...${NC}"
ssh "${SERVER_USER}@${SERVER_HOST}" "cd '${SERVER_PATH}' && \
  if [ -d '${BUILD_NAME}' ]; then \
    mv '${BUILD_NAME}' '${BACKUP_NAME}' && echo 'Backup created: ${BACKUP_NAME}'; \
  else \
    echo 'No previous build to backup'; \
  fi"
echo -e "${GREEN}✓ Backup step done${NC}"

# Keep only the newest backups (names sort by timestamp); KEEP_BACKUPS=0 keeps all
KEEP_BACKUPS="${KEEP_BACKUPS:-3}"
if [ "$KEEP_BACKUPS" -gt 0 ] 2>/dev/null; then
  ssh "${SERVER_USER}@${SERVER_HOST}" "cd '${SERVER_PATH}' && \
    ls -1d '${BUILD_NAME}'.backup.[0-9]*_[0-9]* 2>/dev/null | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | \
    while read -r old; do rm -rf -- \"\$old\" && echo \"Removed old backup: \$old\"; done"
  echo -e "${GREEN}✓ Kept the newest ${KEEP_BACKUPS} backups${NC}"
fi

# Step 6: Upload build
echo -e "\n${YELLOW}Step 6: Uploading build...${NC}"
scp -r "$BUILD_DIR" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/${BUILD_NAME}"
echo -e "${GREEN}✓ Build uploaded${NC}"

# Step 7: Verify deployment
echo -e "\n${YELLOW}Step 7: Verifying deployment...${NC}"
if ssh "${SERVER_USER}@${SERVER_HOST}" "[ -f '${SERVER_PATH}/${BUILD_NAME}/index.html' ] && [ -f '${SERVER_PATH}/${BUILD_NAME}/libraries/ertms.xml' ]"; then
    BUILD_SIZE=$(ssh "${SERVER_USER}@${SERVER_HOST}" "du -sh '${SERVER_PATH}/${BUILD_NAME}' | cut -f1")
    echo -e "${GREEN}✓ Deployment verified${NC}"
    echo -e "${GREEN}  Remote path: ${SERVER_PATH}/${BUILD_NAME}${NC}"
    echo -e "${GREEN}  Remote size: ${BUILD_SIZE}${NC}"
else
    echo -e "${RED}Deployment verification failed (index.html or libraries/ertms.xml missing)${NC}"
    exit 1
fi

if command -v curl > /dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${SERVER_HOST}/${BUILD_NAME}/" || true)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ http://${SERVER_HOST}/${BUILD_NAME}/ answers 200${NC}"
    else
        echo -e "${YELLOW}! http://${SERVER_HOST}/${BUILD_NAME}/ answered ${HTTP_STATUS:-nothing}${NC}"
    fi
fi

# Summary
echo -e "\n${YELLOW}=====================================${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo -e "Backup on server: ${SERVER_PATH}/${BACKUP_NAME} (if a previous build existed)"
echo -e "\nYou can access the application at:"
echo -e "${GREEN}  http://${SERVER_HOST}/${BUILD_NAME}/${NC}"
echo -e "\n${YELLOW}=====================================${NC}"

exit 0
