@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 22.12+ truoc khi chay.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build
if errorlevel 1 (
  echo Build that bai. Xem loi phia tren.
  pause
  exit /b 1
)
echo Mo http://localhost:5178/?premium3d=1 de xem cao va Dao Toan Hoc.
echo Ban PR02 thu nghiem. Giu cua so nay mo khi su dung.
call npm run preview -- --host 0.0.0.0 --port 5178 --strictPort
pause
