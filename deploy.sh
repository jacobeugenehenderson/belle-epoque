#!/bin/bash
# Build and deploy belle-epoque to GitHub Pages

set -e

echo "Building..."
npm run build

echo "Deploying to gh-pages..."
cd dist

# Initialize git in dist if needed
if [ ! -d .git ]; then
  git init
  git remote add origin git@github.com:jacobeugenehenderson/belle-epoque.git
fi

git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M:%S')"
git push -f origin HEAD:gh-pages

cd ..
echo "Done! Site will be live at https://jacobeugenehenderson.github.io/belle-epoque/"
