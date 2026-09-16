# CfxLua Minifier

Minificador e builder lexical para scripts Lua/CfxLua de resources FiveM. Ele deixa o código compacto e difícil de ler, mas não oferece proteção ou criptografia.

Não gera bytecode, não cria VM e não criptografa strings.

## Instalação

### 1. Instale o Lua 5.4

Windows com WinGet:

```powershell
winget install --id Lua.Lua
```

Ou baixe um executável Lua 5.4 para Windows em:

<https://luabinaries.sourceforge.net/download.html>

Confirme que o Lua está disponível:

```bat
lua -v
```

### 2. Instale o lua_minify

No PowerShell, execute um único comando:

```powershell
irm https://raw.githubusercontent.com/developerstriker/cfxlua-minifier/main/install.ps1 | iex
```

Feche e abra o terminal depois da instalação. Confirme:

```bat
lua_minify
```

Se o comando não for encontrado, verifique se `C:\Users\SEU_USUARIO\.local\bin` está no PATH e abra um novo terminal.

## Estrutura do resource

Coloque os fontes em `script-src`. A pasta `script` é gerada automaticamente:

```text
meu-resource/
  fxmanifest.lua              # entrada opcional
  script-src/
    shared/
      config.lua
    modules/
      hud/server/hud.lua
      hud/client/hud.lua
      teste/server/test.lua
    config/                    # ignorada pelo build
  script/                      # saída gerada
```

## Build

Entre na raiz do resource e execute:

```bat
lua_minify .
```

Também é possível informar diretamente a pasta de fontes:

```bat
lua_minify ./script-src
```

O builder remove e recria `script`, processa todos os arquivos de `script-src` recursivamente e ignora `script-src/config`. Todos os arquivos Lua são minificados e agrupados em apenas:

```text
script/server.lua
script/client.lua
```

Arquivos que não são Lua são copiados para `script` mantendo suas subpastas.

## Classificação server/client/shared

Qualquer pasta chamada `server`, em qualquer profundidade, vai para `script/server.lua`:

```text
script-src/modules/server/a.lua
script-src/modules/hud/server/b.lua
```

Qualquer pasta chamada `client`, em qualquer profundidade, vai para `script/client.lua`:

```text
script-src/modules/client/a.lua
script-src/modules/hud/client/b.lua
```

Arquivos dentro de uma pasta `shared`, arquivos na raiz de `script-src` e arquivos sem uma pasta reconhecida são incluídos nos dois arquivos. O manifesto gerado aponta somente para:

```lua
server_script 'script/server.lua'
client_script 'script/client.lua'
```

## O que é preservado

- strings simples (`'...'` e `"..."`);
- long strings (`[[...]]` e variantes com `=`);
- hashes/backticks do CfxLua;
- operadores Lua e CfxLua;
- arquivos que não são Lua.

Comentários, espaços e quebras de linha desnecessários são removidos. Locals simples podem ser renomeados. Salve os fontes como UTF-8 para evitar caracteres inválidos no editor.

## Solução de problemas

### `lua` não é reconhecido

Instale o Lua e abra um novo terminal:

```powershell
winget install --id Lua.Lua
```

### `lua_minify` não é reconhecido

Execute novamente o instalador e abra um novo terminal:

```powershell
irm https://raw.githubusercontent.com/developerstriker/cfxlua-minifier/main/install.ps1 | iex
```

### O build cria pastas inesperadas

Use a versão atual do instalador e execute o comando a partir da raiz do resource:

```bat
lua_minify .
```

O resultado esperado é somente `script/server.lua` e `script/client.lua`, além dos arquivos não-Lua copiados.
