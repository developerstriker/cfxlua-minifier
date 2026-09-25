$ErrorActionPreference = 'Stop'
lua (Join-Path $PSScriptRoot 'scope-regression.lua')
if ($LASTEXITCODE -ne 0) { throw 'Scope regression tests failed' }
$root = Join-Path $env:TEMP ('cfxlua-minifier-test-' + [guid]::NewGuid().ToString('N'))
$src = Join-Path $root 'script-src'
$builder = Join-Path (Split-Path $PSScriptRoot -Parent) 'src\builder.lua'
Push-Location (Split-Path $PSScriptRoot -Parent)
lua tests\minifier.lua
Pop-Location
New-Item -ItemType Directory -Force -Path (Join-Path $src 'modules\server'),(Join-Path $src 'modules\hud\client'),(Join-Path $src 'config') | Out-Null
[IO.File]::WriteAllText((Join-Path $src 'modules\server\a.lua'), "-- remove`nlocal serverValue = 1`nprint('server -- intact')`n")
[IO.File]::WriteAllText((Join-Path $src 'modules\hud\client\b.lua'), "-- remove`nlocal clientValue = 2`nprint(`"client`", ``hash``)`n")
[IO.File]::WriteAllText((Join-Path $src 'config\settings.lua'), "-- must remain`nlocal untouched = true`n")
[IO.File]::WriteAllText((Join-Path $src 'asset.dat'), 'binary-like content')
lua $builder $root
$server = [IO.File]::ReadAllText((Join-Path $root 'script\server.lua'))
$client = [IO.File]::ReadAllText((Join-Path $root 'script\client.lua'))
$config = [IO.File]::ReadAllText((Join-Path $root 'script\config\settings.lua'))
$manifest = [IO.File]::ReadAllText((Join-Path $root 'fxmanifest.lua'))
if ($server -notmatch 'server -- intact' -or $server -match 'client') { throw 'Falha no agrupamento server' }
if ($client -notmatch 'client' -or $client -notmatch '`hash') { throw 'Falha no agrupamento client/hash' }
if ($config -notmatch '-- must remain' -or $config -notmatch 'untouched') { throw 'Config foi alterado' }
if (-not (Test-Path (Join-Path $root 'script\asset.dat'))) { throw 'Arquivo nao-Lua nao foi copiado' }
if ($manifest -notmatch "server_script 'script/server.lua'" -or $manifest -notmatch "client_script 'script/client.lua'") { throw 'Manifesto incorreto' }
if (Get-ChildItem (Join-Path $root 'script') -Recurse -Directory | Where-Object FullName -Match 'script.*Bases|script.*resources') { throw 'Caminho aninhado indevido' }
Remove-Item -LiteralPath $root -Recurse -Force
Write-Host 'Todos os testes passaram.' -ForegroundColor Green
