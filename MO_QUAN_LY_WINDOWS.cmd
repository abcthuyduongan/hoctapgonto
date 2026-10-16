@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
if not exist "dist\index.html" goto missing_build
echo Mo http://127.0.0.1:4180/?online=1 trong trinh duyet.
echo Lan dau: lay ma khoi tao trong .online\bootstrap-token.txt.
echo Du lieu lop, cau hoi va sao duoc luu trong .online\bao-an.sqlite.
node.exe --experimental-strip-types server/run-online.mjs
if errorlevel 1 pause
exit /b
:missing_node
echo Can Node.js 22.22.2 hoac moi hon.
pause
exit /b 1
:missing_build
echo Chay npm install va npm run build truoc khi mo quan ly.
pause
exit /b 1
