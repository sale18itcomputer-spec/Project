@echo off
echo.
echo  =====================================================
echo   Project Dev Starter
echo  =====================================================
echo.

set PROJECT=C:\Users\tonns\Desktop\lpt-system\Project

:: Clean up old URL file
if exist "%PROJECT%\.cloudflared-url" del "%PROJECT%\.cloudflared-url"

:: 1. Start Next.js
start cmd /k "title Next.js ^| Project && cd /d %PROJECT% && npm run dev"

:: 2. Start cloudflared
start cmd /k "title Cloudflared ^| Project && cd /d %PROJECT% && powershell -NoProfile -ExecutionPolicy Bypass -File capture-url.ps1"

:: 3. Register webhook only (no --with-next)
start cmd /k "title Webhook ^| Project && cd /d %PROJECT% && node auto-webhook.mjs"

echo.
echo  3 windows opened.
echo.
echo  IMPORTANT: After tunnel is ready, send /app to the bot
echo  to get a fresh link. Old messages have stale URLs.
echo.
pause
