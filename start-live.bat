@echo off
rem Cyber Mecha Country Wars: one-click start for TikTok LIVE Studio / OBS.
rem 1) installs and builds the game the first time, 2) serves it on http://localhost:5173,
rem 3) optionally starts the TikTok-Live-Connector bridge if you type your TikTok username.
cd /d "%~dp0"
where node >nul 2>nul || (echo Please install Node.js LTS from https://nodejs.org first. & pause & exit /b 1)
if not exist game\node_modules (pushd game & call npm install & popd)
if not exist bridge\node_modules (pushd bridge & call npm install & popd)
pushd game & call npm run build & popd
echo.
echo If TikFinity is running and connected, just press Enter.
set /p TT=Otherwise type your TikTok username (without @) for the bridge: 
if not "%TT%"=="" start "CMCW bridge" cmd /k "cd /d %~dp0bridge && npm start -- %TT%"
start "CMCW game" cmd /k "cd /d %~dp0game && npx vite preview --port 5173 --strictPort"
echo.
echo Add a Browser/Link source in TikTok LIVE Studio or OBS:
echo     http://localhost:5173/?clean^&sound      size 1080 x 1920
echo Test in a browser first without ?clean to see the operator panel.
pause
