#!/bin/bash

# Local CI Test Script
# This script mimics what runs in GitHub Actions for local testing

set -e  # Exit on any error

echo "🚀 Starting local CI test..."

echo "📋 Step 1: Installing dependencies..."
npm ci

echo "🔍 Step 2: Running ESLint..."
npm run lint

echo "📝 Step 3: Type checking..."
npm run typecheck

echo "🧪 Step 4: Running tests..."
npm run test:run

echo "🏗️  Step 5: Building application..."
npm run build

echo "✅ All CI steps completed successfully!"
echo ""
echo "🎉 Your code is ready for GitHub Actions!"
