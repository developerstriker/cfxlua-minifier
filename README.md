# CfxLua Minifier

Builder/minifier lexical para resources FiveM. Remove comentarios e espacos/quebras desnecessarios, preserva strings normais, long strings, hashes/backticks e operadores CfxLua, e renomeia locals simples. Nao gera bytecode, nao usa VM e nao criptografa strings.

## Estrutura

```text
meu-resource/
  fxmanifest.lua
  script-src/           # fonte; script-src/config e ignorada
  script/               # saida gerada
```

## Uso

```text
lua src/builder.lua caminho/para/meu-resource
```

Sem caminho, o diretorio atual e usado. Todos os arquivos de `script-src` sao copiados para `script`, mantendo subpastas; arquivos `.lua` sao minificados. O `fxmanifest.lua` na raiz e atualizado para carregar somente `script/**/*.lua`.

O renomeador e deliberadamente conservador e voltado a locals simples. O processamento e lexical para nao reescrever conteudo protegido de strings.
