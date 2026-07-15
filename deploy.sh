#!/bin/bash

# Railway Drawer Deployment Script
# Builds the project and deploys to local server

set -e  # Exit on error

# Configuration
SERVER_HOST="192.168.10.22"
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
    echo -e "${RED}❌ Error: package.json not found${NC}"
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
npm install || npm install --legacy-peer-deps
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Step 3: Build project
echo -e "\n${YELLOW}Step 3: Building project...${NC}"
npm run build
if [ -d "$BUILD_DIR" ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
    echo -e "${GREEN}  Build directory: $BUILD_DIR${NC}"
    echo -e "${GREEN}  Build size: $(du -sh $BUILD_DIR | cut -f1)${NC}"
else
    echo -e "${RED}❌ Build failed - $BUILD_DIR not found${NC}"
    exit 1
fi

# Step 4: Deploy to server
echo -e "\n${YELLOW}Step 4: Deploying to server...${NC}"
echo -e "${YELLOW}  Server: ${SERVER_USER}@${SERVER_HOST}${NC}"
echo -e "${YELLOW}  Path: ${SERVER_PATH}/${BUILD_NAME}${NC}"

# Check SSH connectivity
if ! ssh -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_HOST}" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to server${NC}"
    echo -e "${RED}  Check: ssh ${SERVER_USER}@${SERVER_HOST}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ SSH connection OK${NC}"

# Create backup of old build on server
echo -e "\n${YELLOW}Step 5: Creating backup on server...${NC}"
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${SERVER_PATH} && \
  if [ -d '${BUILD_NAME}' ]; then \
    mv '${BUILD_NAME}' '${BUILD_NAME}.backup.$(date +%Y%m%d_%H%M%S)'; \
    echo 'Backup created'; \
  else \
    echo 'No previous build to backup'; \
  fi"
echo -e "${GREEN}✓ Backup created${NC}"

# Deploy build
echo -e "\n${YELLOW}Step 6: Uploading build...${NC}"
scp -r "$BUILD_DIR" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/${BUILD_NAME}"
echo -e "${GREEN}✓ Build uploaded${NC}"

# Verify deployment
echo -e "\n${YELLOW}Step 7: Verifying deployment...${NC}"
if ssh "${SERVER_USER}@${SERVER_HOST}" "[ -d '${SERVER_PATH}/${BUILD_NAME}' ]"; then
    BUILD_SIZE=$(ssh "${SERVER_USER}@${SERVER_HOST}" "du -sh ${SERVER_PATH}/${BUILD_NAME} | cut -f1")
    echo -e "${GREEN}✓ Deployment verified${NC}"
    echo -e "${GREEN}  Remote path: ${SERVER_PATH}/${BUILD_NAME}${NC}"
    echo -e "${GREEN}  Remote size: ${BUILD_SIZE}${NC}"
else
    echo -e "${RED}❌ Deployment verification failed${NC}"
    exit 1
fi

# Summary
echo -e "\n${YELLOW}=====================================${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo -e "Build location: http://${SERVER_HOST}/${BUILD_NAME}"
echo -e "\nYou can access the application at:"
echo -e "${GREEN}  http://${SERVER_HOST}/${BUILD_NAME}/${NC}"
echo -e "\n${YELLOW}=====================================${NC}"

exit 0
