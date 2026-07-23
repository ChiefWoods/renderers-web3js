# Codama ➤ Renderers ➤ Web3.js

[![npm][npm-image]][npm-url]
[![npm-downloads][npm-downloads-image]][npm-url]

[npm-downloads-image]: https://img.shields.io/npm/dm/renderers-web3js.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/renderers-web3js.svg?style=flat&label=renderers-web3js
[npm-url]: https://www.npmjs.com/package/renderers-web3js

This package generates TypeScript clients from your Codama IDLs. The generated clients are compatible with [`@solana/web3.js`](https://github.com/solana-foundation/solana-web3.js).

## Installation

```sh
pnpm install renderers-web3js
```

## Usage

Add the following script to your Codama configuration file.

```json
{
    "scripts": {
        "web3js": {
            "from": "renderers-web3js",
            "args": ["clients/js"]
        }
    }
}
```

The first argument is the output folder. The generated files will be written there.

An object can be passed as a second argument to further configure the renderer. See the [Options](#options) section below for more details.

## Options

The `renderVisitor` accepts the following options.

| Name                          | Type           | Default     | Description                                                               |
| ----------------------------- | -------------- | ----------- | ------------------------------------------------------------------------- |
| `deleteFolderBeforeRendering` | `boolean`      | `true`      | Whether the base directory should be cleaned before generating new files. |
| `formatCode`                  | `boolean`      | `true`      | Whether we should use Oxfmt to format the generated code.                 |
| `packageFolder`               | `string`       | `undefined` | Optional package folder appended to the output path when rendering.       |
| `oxfmtOptions`                | `OxfmtOptions` | `{}`        | The options to use when formatting the code using Oxfmt.                  |
| `extension`                   | `string`       | `'ts'`      | The file extension used for generated source files.                       |
| `indexFilename`               | `string`       | `'index'`   | The base filename used for generated index files (before the extension).  |
| `typeIndent`                  | `string`       | `'    '`    | The indentation string used when rendering multiline type fragments.      |

## Credits

This project is based on [`@pratikbuilds/web3js-legacy`](https://github.com/pratikbuilds/renderers-js-web3js)
by [Pratik](https://github.com/pratikbuilds).
