@echo off
setlocal
cd /d "%~dp0"
echo.
echo   BAO AN LEARNING V3 - LOCAL DEVELOPMENT
where node >nul 2>nul
if errorlevel 1 (
  echo Loi: Ban chua cai Node.js 22.12+.
  echo Truy cap https://nodejs.org/ va cai Node.js, sau do thu lai.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Cai cac thu vien (can Internet lan dau)...
  call npm install
  if errorlevel 1 (
    echo Cai thu vien that bai. Kiem tra ket noi Internet.
    pause
    exit /b 1
  )
)
echo Mo trang http://localhost:5173 sau khi server chay.
call npm run dev
pause
