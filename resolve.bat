@echo off
git checkout --theirs frontend\index.html
git checkout --theirs frontend\package-lock.json
git checkout --theirs frontend\package.json
git checkout --theirs frontend\src\App.css
git checkout --theirs frontend\src\App.jsx
git checkout --theirs frontend\src\index.css
git checkout --theirs frontend\src\main.jsx
git add frontend\index.html frontend\package-lock.json frontend\package.json frontend\src\App.css frontend\src\App.jsx frontend\src\index.css frontend\src\main.jsx
echo Done!
