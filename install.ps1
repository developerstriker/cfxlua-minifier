$ErrorActionPreference = 'Stop'
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Instale Node.js 20+ com npm em https://nodejs.org/ e abra um novo terminal. Lua nao e mais necessario.'
}
& npm.cmd install -g github:developerstriker/cfxlua-minifier
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar o pacote npm.' }
Write-Host 'Instalado. Execute: lua_minify ./script-src'
