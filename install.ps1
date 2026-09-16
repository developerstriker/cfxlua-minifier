$ErrorActionPreference = 'Stop'
$repo = 'https://raw.githubusercontent.com/SuricatoX/lua_builder/main'
$bin = Join-Path $env:LOCALAPPDATA 'lua-minify\bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null

$lua = Get-Command lua -ErrorAction SilentlyContinue
if (-not $lua) {
  Write-Host 'Lua nao foi encontrado no PATH.' -ForegroundColor Yellow
  Write-Host 'Instale Lua 5.4 e abra um novo terminal. Opcoes:'
  Write-Host '  winget install Lua.Lua'
  Write-Host '  https://luabinaries.sourceforge.net/download.html'
  exit 1
}

Invoke-WebRequest "$repo/src/builder.lua" -OutFile (Join-Path $bin 'builder.lua')
$launcher = Join-Path $bin 'lua_minify.cmd'
$content = "@echo off`r`nlua `"$bin\builder.lua`" %*`r`n"
[IO.File]::WriteAllText($launcher, $content, [Text.Encoding]::ASCII)
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($path -split ';') -notcontains $bin) {
  [Environment]::SetEnvironmentVariable('Path', (($path.TrimEnd(';') + ';' + $bin).TrimStart(';')), 'User')
}
Write-Host "lua_minify instalado em $bin" -ForegroundColor Green
Write-Host 'Feche e abra o terminal e execute: lua_minify .'
