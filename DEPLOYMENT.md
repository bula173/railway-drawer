# Deployment Guide

## Overview

Two deployment scripts are provided for pushing builds to your local web server:

1. **`deploy.sh`** - Full featured deployment with backups and verification
2. **`quick-deploy.sh`** - Minimal fast deployment

## Prerequisites

- Node.js and npm installed
- SSH access to server (root user)
- Web server running on `192.168.10.22` (Apache/Nginx or similar)
- `/var/www/html/` directory on server (or configure custom path)

## Quick Start

### Option 1: Quick Deploy (Fastest)

```bash
# From project root directory
./quick-deploy.sh
```

This will:
1. Build the project
2. Deploy to `192.168.10.22` at `/var/www/html/railway-drawer`
3. Done!

### Option 2: Custom Server Details

```bash
# Custom host and path
./quick-deploy.sh 192.168.10.100 root /var/www/html

# Or separate user
./quick-deploy.sh 192.168.10.22 deploy /home/deploy/web
```

### Option 3: Full Deploy (With Backups)

```bash
# From project root directory
./deploy.sh
```

This will:
1. Clean previous builds
2. Install dependencies
3. Build the project
4. Create backup of old deployment on server
5. Upload new build
6. Verify deployment
7. Show access URL

## Configuration

### Default Settings

```
Server Host:    192.168.10.22
Server User:    root
Server Path:    /var/www/html
App Path:       /var/www/html/railway-drawer
Build Directory: dist
```

### Change Default Configuration

Edit the scripts and modify these lines:

**deploy.sh (lines 10-14):**
```bash
SERVER_HOST="192.168.10.22"
SERVER_USER="root"
SERVER_PATH="/var/www/html"
BUILD_DIR="dist"
BUILD_NAME="railway-drawer"
```

**quick-deploy.sh (lines 5-7):**
```bash
SERVER_HOST="${1:-192.168.10.22}"
SERVER_USER="${2:-root}"
SERVER_PATH="${3:-/var/www/html}"
```

## Usage Examples

### Example 1: Deploy to Default Server

```bash
./quick-deploy.sh
# Result: http://192.168.10.22/railway-drawer/
```

### Example 2: Deploy to Different Server

```bash
./quick-deploy.sh 192.168.1.100
# Result: http://192.168.1.100/railway-drawer/
```

### Example 3: Deploy to Custom Path

```bash
./deploy.sh
# Modify lines 10-14 first, then run
```

### Example 4: Deploy as Different User

```bash
./quick-deploy.sh 192.168.10.22 deploy /home/deploy/www
```

## What Gets Deployed

The `dist/` directory containing:
```
railway-drawer/
├── index.html          (entry point)
├── assets/
│   ├── index-XXX.js    (minified bundle)
│   ├── index-XXX.css   (minified styles)
│   └── ...             (fonts, images, etc)
└── ...                 (all built files)
```

## Accessing the Application

After successful deployment:

```
http://192.168.10.22/railway-drawer/
```

Or replace with your server address.

## Troubleshooting

### SSH Connection Failed

```bash
# Test SSH connection manually
ssh root@192.168.10.22 "echo OK"

# Check SSH key if using key-based auth
ssh -i ~/.ssh/id_rsa root@192.168.10.22 "echo OK"
```

### Permission Denied

```bash
# Ensure scripts are executable
chmod +x deploy.sh quick-deploy.sh

# Check server permissions
ssh root@192.168.10.22 "ls -la /var/www/html"
```

### Build Directory Not Found

```bash
# Check build output
npm run build
ls -la dist/

# Ensure Vite is installed
npm install
```

### SCP Transfer Failed

```bash
# Test SCP manually
scp -r dist root@192.168.10.22:/tmp/test

# Check available space on server
ssh root@192.168.10.22 "df -h /var/www/html"
```

## Server Setup (First Time)

If setting up a new server:

```bash
# Create directory
ssh root@192.168.10.22 "mkdir -p /var/www/html"

# Set permissions
ssh root@192.168.10.22 "chmod 755 /var/www/html"

# Verify
ssh root@192.168.10.22 "ls -la /var/www/html"
```

## Automation with Cron

Schedule automatic deployments:

```bash
# Edit crontab
crontab -e

# Deploy every day at 2 AM
0 2 * * * cd /Users/Marcin/workspace/workspace_tsx/railway-drawer && ./quick-deploy.sh
```

## Backup Management

The `deploy.sh` script automatically creates backups:

```
/var/www/html/railway-drawer.backup.20260624_153045/
/var/www/html/railway-drawer.backup.20260624_120000/
```

To restore a backup:

```bash
ssh root@192.168.10.22 "cd /var/www/html && \
  rm -rf railway-drawer && \
  mv railway-drawer.backup.20260624_153045 railway-drawer"
```

## Performance Tips

1. **Gzip compression** - Ensure server has gzip enabled
2. **Caching** - Set cache headers in server config
3. **CDN** - Consider serving assets from CDN
4. **Minification** - Vite automatically minifies
5. **Image optimization** - Already handled by build

## Web Server Configuration

### Apache (.htaccess)

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /railway-drawer/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . index.html [L]
</IfModule>
```

### Nginx

```nginx
location /railway-drawer/ {
  try_files $uri $uri/ /railway-drawer/index.html;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
}
```

## Verification Checklist

- [ ] SSH connection works
- [ ] Build directory exists: `dist/`
- [ ] `index.html` present in build
- [ ] Server path accessible
- [ ] Web server running
- [ ] Permissions set correctly (755 on directory)
- [ ] Application loads in browser
- [ ] All features work

## Logs

View deployment logs:

```bash
# Build logs
npm run build 2>&1 | tee build.log

# SSH logs
ssh -v root@192.168.10.22 "echo OK" 2>&1 | grep -i error
```

## Advanced: Custom Deploy Script

Create your own deploy script:

```bash
#!/bin/bash
set -e
npm run build
scp -r dist root@192.168.10.22:/var/www/html/railway-drawer
echo "✅ Deployed to http://192.168.10.22/railway-drawer/"
```

## Support

For issues:
1. Check SSH connectivity
2. Verify server path exists
3. Check build directory
4. Review error messages
5. Test manually with SCP

## See Also

- [README.md](README.md) - Project overview
- [CONTRIBUTING.md](documentation/CONTRIBUTING.md) - Development guide
- [ARCHITECTURE.md](documentation/ARCHITECTURE.md) - Technical architecture
