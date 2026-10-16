@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "BAO_AN_DATA_DIR=%~dp0data"
node.exe "%~dp0backup-online.mjs"
pause
