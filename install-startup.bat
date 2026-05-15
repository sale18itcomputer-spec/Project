@echo off
:: Remove old broken startup script and install the new one

set STARTUP=C:\Users\tonns\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
set PROJECT=C:\Users\tonns\Project

if exist "%STARTUP%\start-project-auto.bat" (
    del "%STARTUP%\start-project-auto.bat"
    echo Removed old start-project-auto.bat
)
if exist "%STARTUP%\start-project.bat" (
    del "%STARTUP%\start-project.bat"
    echo Removed old start-project.bat
)
if exist "%STARTUP%\start-dev.bat" (
    del "%STARTUP%\start-dev.bat"
)

copy /Y "%PROJECT%\start-dev.bat" "%STARTUP%\start-dev.bat"
echo Installed new start-dev.bat to Startup.

echo.
echo Done! Run start-dev.bat now to test.
pause
