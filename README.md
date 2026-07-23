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

The first argument is the package folder — i.e. where the `package.json` lives. The generated files will be written to `src/generated` within that folder by default.

An object can be passed as a second argument to further configure the renderer. See the [Options](#options) section below for more details.

## Options

The `renderVisitor` accepts the following options.

| Name                          | Type           | Default           | Description                                                                                                                              |
| ----------------------------- | -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `deleteFolderBeforeRendering` | `boolean`      | `true`            | Whether the base directory should be cleaned before generating new files.                                                                |
| `formatCode`                  | `boolean`      | `true`            | Whether we should use Oxfmt to format the generated code.                                                                                |
| `packageFolder`               | `string`            | `'src/generated'` | The path to the generated folder relative to the package folder. Pass an empty string to write directly to the first argument. |
| `oxfmtOptions`                | `OxfmtOptions`      | `{}`              | The options to use when formatting the code using Oxfmt.                                                                       |
| `customAccountData`           | `CustomDataOptions[]` | `[]`            | The names of all `AccountNodes` whose data should be manually written in TypeScript.                                           |
| `customInstructionData`       | `CustomDataOptions[]` | `[]`            | The names of all `InstructionNodes` whose data should be manually written in TypeScript.                                       |
| `linkOverrides`               | `LinkOverrides`     | `{}`              | An object that overrides the import path of link nodes. For instance, `{ definedTypes: { counter: 'hooked' } }` uses the `hooked` folder to import any link node referring to the `counter` type. |
| `internalNodes`               | `string[]`          | `[]`              | The names of all nodes that should be generated but not exported by the `index.ts` files.                                      |
| `renderParentInstructions`    | `boolean`           | `false`           | When using nested instructions, whether the parent instructions should also be rendered. When set to `false` (default), only the instruction leaves are being rendered. |

## Credits

This project is based on [`@pratikbuilds/web3js-legacy`](https://github.com/pratikbuilds/renderers-js-web3js)
by [Pratik](https://github.com/pratikbuilds).
