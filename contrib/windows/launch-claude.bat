@echo off
rem Pusula — launch Claude Code pointed at the local Pusula server (Windows).
rem Wraps `pusula launch` from the source checkout so no global install is needed.
rem
rem Usage:  launch-claude.bat [project-folder] [pusula launch args...]
rem   - From a terminal inside your project: launch-claude.bat            (opens here)
rem   - Double-click: prompts for the project folder (Enter = current folder)
rem Claude Code is started in the PROJECT folder, never in the Pusula checkout —
rem otherwise it loads this repo's CLAUDE.md/AGENTS.md (~60k chars) into every session.
setlocal enabledelayedexpansion
title Claude Code via Pusula
set "PUSULA_ROOT=%~dp0..\.."

if exist "%~1\" (
  cd /d "%~1"
  shift
) else (
  set "PROJ="
  set /p "PROJ=Project folder (Enter = current: %CD%): "
  if not "!PROJ!"=="" cd /d "!PROJ!"
)

set "ARGS="
:collect
if "%~1"=="" goto run
set "ARGS=!ARGS! %1"
shift
goto collect

:run
node "%PUSULA_ROOT%\bin\pusula.mjs" launch!ARGS!
endlocal
pause
