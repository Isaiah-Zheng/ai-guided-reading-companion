@echo off
cd /d "%~dp0"
set AI_PROVIDER=ollama
set OLLAMA_MODEL=qwen3.5:4b
python backend\start.py
pause
