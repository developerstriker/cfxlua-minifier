@echo off
rem Compatibility launcher for installations made before the npm migration.
call "%APPDATA%\npm\lua_minify.cmd" %*
exit /b %errorlevel%
