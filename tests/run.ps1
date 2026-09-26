$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
} finally { Pop-Location }
