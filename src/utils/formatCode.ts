import { format, type FormatConfig } from 'oxfmt';

import type { RenderOptions } from './options';

export type OxfmtOptions = FormatConfig;

const DEFAULT_OXFMT_OPTIONS: OxfmtOptions = {
    arrowParens: 'avoid',
    bracketSameLine: false,
    bracketSpacing: true,
    jsxSingleQuote: false,
    printWidth: 120,
    quoteProps: 'as-needed',
    semi: true,
    singleQuote: true,
    tabWidth: 4,
    useTabs: false,
};

export type CodeFormatter = (code: string) => Promise<string>;

export function getCodeFormatter(options: Pick<RenderOptions, 'formatCode' | 'oxfmtOptions'>): Promise<CodeFormatter> {
    const shouldFormatCode = options.formatCode ?? true;
    if (!shouldFormatCode) return Promise.resolve(code => Promise.resolve(code));

    const oxfmtOptions: OxfmtOptions = {
        ...DEFAULT_OXFMT_OPTIONS,
        ...options.oxfmtOptions,
    };

    return Promise.resolve(async code => {
        const { code: formatted } = await format('generated.ts', code, oxfmtOptions);
        return formatted;
    });
}
