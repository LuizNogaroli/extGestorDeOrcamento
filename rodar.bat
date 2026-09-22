@echo off
title extGestorDeOrcamento Servidor
cd /d "%~dp0"

start "" http://localhost:8010/popup/popup.html

where python >nul 2>nul
if %errorlevel%==0 (
  python tools\dev-server.py
) else (
  py tools\dev-server.py
)
