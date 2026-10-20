@echo off
chcp 65001 >nul
cd /d "%~dp0"
python kindle_capture.py --pages 5
echo.
pause
