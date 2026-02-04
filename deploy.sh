#!/bin/bash
# Build and deploy to jacobhenderson.studio/belle-epoque

set -e

echo "Building..."
npm run build

echo "Copying to jacobhenderson-studio..."
rm -rf /Volumes/Today/jacobhenderson-studio/belle-epoque
cp -r dist /Volumes/Today/jacobhenderson-studio/belle-epoque

echo "Done! Now cd to jacobhenderson-studio to commit and push."
