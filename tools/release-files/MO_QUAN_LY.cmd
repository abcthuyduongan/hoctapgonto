@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
if not exist "%~dp0app\index.html" goto missing_app
set "BAO_AN_STATIC_DIR=%~dp0app"
set "BAO_AN_DATA_DIR=%~dp0data"
echo Bao An - Quan ly lop, hoc lieu va doi sao tren may
echo Mo http://127.0.0.1:4180/?online=1 trong trinh duyet.
echo Lan dau: lay ma khoi tao trong data\bootstrap-token.txt.
echo Giu cua so nay trong luc su dung. Nhan Ctrl+C de dung.
node.exe "%~dp0online-local.mjs"
if errorlevel 1 pause
exit /b
:missing_node
echo Can cai Node.js 22.22.2 hoac moi hon de chay quan ly cuc bo.
pause
exit /b 1
:missing_app
echo Hay giai nen day du ZIP truoc khi mo MO_QUAN_LY.cmd.
pause
exit /b 1
