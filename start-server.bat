@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -m http.server 8765
) else (
  python -m http.server 8765
)
