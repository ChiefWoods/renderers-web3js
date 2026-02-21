import { Plugin } from 'prettier';
import * as babelPlugin from 'prettier/plugins/babel';
import * as estreePlugin from 'prettier/plugins/estree';
import * as typeScriptPlugin from 'prettier/plugins/typescript';
import { format } from 'prettier/standalone';

import type { RenderOptions } from './options';

export type PrettierOptions = Parameters<typeof format>[1];

const DEFAULT_PRETTIER_OPTIONS: PrettierOptions = {
    plugins: [estreePlugin as Plugin<unknown>, typeScriptPlugin, babelPlugin],
};

export type CodeFormatter = (code: string) => Promise<string>;

export function getCodeFormatter(
    options: Pick<RenderOptions, 'formatCode' | 'prettierOptions'>,
): Promise<CodeFormatter> {
    const shouldFormatCode = options.formatCode ?? true;
    if (!shouldFormatCode) return Promise.resolve(code => Promise.resolve(code));

    const prettierOptions: PrettierOptions = {
        ...DEFAULT_PRETTIER_OPTIONS,
        ...options.prettierOptions,
    };

    return Promise.resolve(code => format(code, { ...prettierOptions, filepath: 'generated.ts' }));
}
