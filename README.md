# CfxLua Minifier

Builder e minifier de resources FiveM escrito em JavaScript. Requer apenas **Node.js 20+ com npm**. Não precisa instalar Lua ou luac.

## Instalação e atualização

Instale Node.js pelo [site oficial](https://nodejs.org/) e execute:

```sh
npm install -g github:developerstriker/cfxlua-minifier
lua_minify --version
```

O mesmo comando atualiza uma instalação existente. A versão JavaScript começa em **0.2.0**. Se um launcher antigo estiver sendo encontrado primeiro, confira `where lua_minify` no Windows ou `which lua_minify` no Linux/macOS e retire o launcher antigo do PATH.

O pacote ainda não foi publicado no registro npm; use o endereço GitHub acima. Também pode instalar o arquivo local gerado por `npm pack`:

```sh
npm install -g ./cfxlua-minifier-0.2.0.tgz
```

## Uso

Na raiz do resource:

```sh
lua_minify .
# ou
lua_minify ./script-src
```

Caminhos com espaços devem estar entre aspas.

```text
resource/
  fxmanifest.lua
  script-src/
    config/settings.lua
    modules/hud/server/main.lua
    modules/hud/client/main.lua
    shared/common.lua
  script/
    config/settings.lua
    server.lua
    client.lua
```

- Diretórios chamados `server` ou `client`, em qualquer profundidade, determinam o lado. Se ambos ocorrerem, server tem precedência.
- Arquivos chamados `server.lua` e `client.lua` também são classificados, quando não há diretório de lado.
- Demais arquivos Lua são shared: incluídos antes dos arquivos específicos nos dois bundles.
- Cada arquivo é envolvido em um bloco `do ... end` para isolar suas variáveis locais.
- Qualquer diretório `config` é copiado byte a byte. Seus arquivos Lua são listados no manifesto antes dos bundles, pelo lado correspondente (shared por padrão).
- Arquivos não-Lua são copiados byte a byte, preservando os caminhos.
- A ordem de leitura é alfabética e determinística. Dependências que exigem uma ordem específica devem seguir essa organização.

A pasta `script` anterior é mantida como `script.backup-...`. A geração é preparada antes da troca de saída; erros de análise preservam os arquivos existentes.

O manifesto mantém metadados como `ui_page`, `files`, `dependency` e `data_file`. Declarações literais de scripts, inclusive listas multilinha, são substituídas pelas saídas; imports `@outro_resource/...` são mantidos. Não execute manifestos para descobrir arquivos: a entrada é sempre `script-src`. Declarações dinâmicas de scripts não são suportadas.

## Minificação

Remove comentários e espaços desnecessários e renomeia locals por escopo, inclusive parâmetros, loops e closures:

```lua
local source = source
local user_id = core.Passport(source)
```

torna-se:

```lua
local _a=source local _b=core.Passport(_a)
```

Strings, long strings, hashes em backticks, campos públicos e globais são preservados. `_ENV` e o `self` implícito de métodos mantêm seu significado.

Não gera bytecode, VM ou decodificadores. Não é proteção contra engenharia reversa.

## Ignorar arquivos

Crie `.minifyignore` na raiz. Os caminhos são relativos a `script-src`:

```text
# comentários
debug/
*.skip.lua
modules/test/*
```

`*` corresponde a qualquer sequência, incluindo barras. Um caminho terminado em `/` ignora seus descendentes. Arquivos ignorados não são copiados.

## Testes e desenvolvimento

```sh
npm test
npm pack
```

Os testes não exigem Lua, incluindo um build com PATH vazio. O workflow do GitHub testa Windows, Linux e macOS. Validações locais não equivalem a testes dentro de um servidor FiveM.

## Limitações

O analisador suporta o subconjunto Lua implementado e hashes CfxLua; não é um compilador completo de todas as extensões FiveM. Atributos locais `<const>`/`<close>` e operadores adicionais não implementados são rejeitados. Teste o resource no FiveM antes de usar em produção.

A junção não implementa um carregador de módulos: `require`, retornos de chunks e código que depende de caminhos ou informações de debug precisam de revisão. Um retorno no nível do arquivo termina também o bundle. Links simbólicos são rejeitados.

Para publicar no registro npm, o mantenedor precisa autenticar sua conta e ter acesso ao nome: `npm login`, seguido de `npm publish`.
