# Codama ➤ @solana/web3.js

[![npm][npm-image]][npm-url]
[![npm-downloads][npm-downloads-image]][npm-url]
[![license][license-image]][license-url]

[npm-downloads-image]: https://img.shields.io/npm/dm/%40pratikbuilds%2Fweb3js-legacy.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/@pratikbuilds/web3js-legacy.svg?style=flat&label=%40pratikbuilds%2Fweb3js-legacy
[npm-url]: https://www.npmjs.com/package/@pratikbuilds/web3js-legacy
[license-image]: https://img.shields.io/npm/l/%40pratikbuilds%2Fweb3js-legacy?style=flat
[license-url]: https://www.npmjs.com/package/@pratikbuilds/web3js-legacy

This package provides a Codama renderer for Web3.js to generate type-safe client code for Solana programs.
NPM package path: `@pratikbuilds/web3js-legacy`.

## Installation

```sh
pnpm add @pratikbuilds/web3js-legacy
```

## Usage

Add the following script to your Codama configuration file (e.g. `codama.json`).

```json
{
    "scripts": {
        "web3js": {
            "from": "@pratikbuilds/web3js-legacy",
            "args": ["docs"]
        }
    }
}
```

Then run your Codama script:

```sh
codama run web3js
```

## TODO

- Add remaining accounts as input to instructions
- Add PDALink node resolution in default params
- do more testing with either isSigner type
- add enums data type parsing
