# Codama ➤ Web3.js ➤ Legacy

[![npm][npm-image]][npm-url]
[![npm-downloads][npm-downloads-image]][npm-url]

[npm-downloads-image]: https://img.shields.io/npm/dm/@codama/web3js-legacy.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/@codama/web3js-legacy.svg?style=flat&label=%40codama%2Fweb3js-legacy
[npm-url]: https://www.npmjs.com/package/@codama/web3js-legacy

This package provides a Codama renderer for Web3.js to generate type-safe client code for Solana programs.

## Installation

```sh
pnpm install @codama/web3js-legacy
```

## Usage

Add the following script to your Codama configuration file.

```json
{
    "scripts": {
        "demo": {
            "from": "@codama/web3js-legacy",
            "args": ["docs"]
        }
    }
}
```
