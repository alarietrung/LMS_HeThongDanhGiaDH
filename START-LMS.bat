@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
echo LMS MITUNI: http://localhost:3000
call npm run dev
