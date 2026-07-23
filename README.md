# Codama -> @solana/web3.js Legacy Renderer

[![npm][npm-image]][npm-url]
[![npm-downloads][npm-downloads-image]][npm-url]
[![license][license-image]][license-url]

[npm-downloads-image]: https://img.shields.io/npm/dm/renderers-web3js.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/renderers-web3js.svg?style=flat&label=renderers-web3js
[npm-url]: https://www.npmjs.com/package/renderers-web3js
[license-image]: https://img.shields.io/npm/l/renderers-web3js?style=flat
[license-url]: https://www.npmjs.com/package/renderers-web3js

`renderers-web3js` is a Codama renderer for generating TypeScript
clients that use the classic `@solana/web3.js` APIs.

It takes a Solana IDL and generates code for:

- instruction builders
- account data types and fetch helpers
- defined type codecs
- PDA helpers
- program constants and exports

Use this when your project wants generated Solana client code but still works
with `PublicKey`, `Connection`, `TransactionInstruction`, and the rest of
`@solana/web3.js` v1.

## Installation

```sh
bun add renderers-web3js
bun add -d @codama/cli
```

Requires Node.js `>=20.18.0`.

## Usage

Add the renderer to your `codama.json`.

```json
{
    "idl": "idl.json",
    "scripts": {
        "web3js": {
            "from": "renderers-web3js",
            "args": ["src/generated"]
        }
    }
}
```

Run it:

```sh
bunx codama run web3js
```

The first argument is the output folder. In this example, generated files are
written to `src/generated`.

## Options

The `renderVisitor` accepts the following options.

| Name                          | Type           | Default     | Description                                                                                         |
| ----------------------------- | -------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `deleteFolderBeforeRendering` | `boolean`      | `true`      | Whether the output directory should be deleted before generating new files.                         |
| `formatCode`                  | `boolean`      | `true`      | Whether generated source files should be formatted with Oxfmt.                                      |
| `packageFolder`               | `string`       | `undefined` | Optional package folder associated with rendering configuration.                                    |
| `oxfmtOptions`                | `OxfmtOptions` | `{}`        | Additional options passed to Oxfmt when formatting generated code.                                  |
| `extension`                   | `string`       | `'ts'`      | File extension used for generated source files.                                                     |
| `indexFilename`               | `string`       | `'index'`   | Base filename used for generated index files (before extension).                                    |
| `typeIndent`                  | `string`       | `undefined` | Optional indentation string used when rendering multiline type fragments in generated source files. |

## Generated Code

The generated folder usually looks like this:

```txt
src/generated/
├── index.ts
├── accounts/
├── instructions/
├── pdas/
└── types/
```

Instruction builders return `TransactionInstruction`.

```ts
import { createTransferSolInstruction } from './generated/instructions/transferSol';

const instruction = createTransferSolInstruction(
    {
        source: payer.publicKey,
        destination,
    },
    {
        amount: 1_000_000n,
    },
);
```

Account helpers can fetch and deserialize account data.

```ts
import { fetchNonceAccount } from './generated/accounts/nonce';

const nonce = await fetchNonceAccount(connection, nonceAddress);
```

## Development

```sh
bun install
bun run build
bun run test
```

Useful focused commands:

```sh
bun run test:unit
bun run test:types
bun run test:e2e
bun run test:generated
```

## Contributing

Contributions are welcome. Please keep changes focused and include tests for any
generated-code behavior you change.

For renderer changes, it is helpful to:

- update the related unit tests
- regenerate affected fixtures under `test/e2e`
- run `bun run build`
- run the relevant tests, or `bun run test`

## Credits

This project is based on [`@pratikbuilds/web3js-legacy`](https://github.com/pratikbuilds/renderers-js-web3js)
by [Pratik](https://github.com/pratikbuilds).

## License

MIT
