@echo off
rem Double-click to run Unit Cell Explorer locally.
rem Installs dependencies the first time (and whenever a new package was added),
rem then starts the Vite dev server and opens http://localhost:5173 in your browser.
rem Close this window to stop it.
cd /d "%~dp0"
node scripts\check-deps.cjs >nul 2>&1
if errorlevel 1 (
  echo Installing dependencies - this only happens when something new is needed...
  call npm install || goto :error
)
call npm run dev
goto :eof

:error
echo.
echo Something went wrong. Is Node.js installed? Get it from https://nodejs.org
pause
