#!/bin/bash

# Script to import multiple draw.io shape libraries
# Usage: ./scripts/import-all-drawio.sh

set -e

echo "🎨 Draw.io Shape Importer"
echo "=========================="

# Import specific shape libraries
libraries=(
  "mxBasic:Draw.io Basic"
  "mxArrows:Draw.io Arrows"
  "mxFlowchart:Draw.io Flowchart"
  "mxEip:Draw.io EIP"
)

for lib in "${libraries[@]}"; do
  IFS=':' read -r libName libGroup <<< "$lib"
  echo ""
  echo "📦 Importing $libName..."
  npx ts-node scripts/import-drawio-shapes.ts "$libName" "src/shapes/drawio-${libName,,}" "$libGroup"
done

echo ""
echo "✅ All imports complete!"
echo ""
echo "📝 Don't forget to update src/shapes/index.ts with the registration calls"
