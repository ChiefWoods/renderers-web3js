import { Docs } from '@codama/nodes';
import { BaseFragment, createFragmentTemplate, mapFragmentContent, Path } from '@codama/renderers-core';

import {
    addToImportMap,
    createImportMap,
    getImportStatements,
    ImportMap,
    mergeImportMaps,
    PathOverrides,
} from './importMap';

export type Fragment = BaseFragment & Readonly<{ imports: ImportMap }>;

function createFragment(content: string): Fragment {
    return Object.freeze({ content, imports: createImportMap() });
}

function isFragment(value: unknown): value is Fragment {
    return typeof value === 'object' && value !== null && 'content' in value;
}

export function fragment(template: TemplateStringsArray, ...items: unknown[]): Fragment {
    return createFragmentTemplate(template, items, isFragment, mergeFragments);
}

export function mergeFragments(
    fragments: (Fragment | undefined)[],
    mergeContent: (contents: string[]) => string,
): Fragment {
    const filteredFragments = fragments.filter((f): f is Fragment => f !== undefined);
    return Object.freeze({
        content: mergeContent(filteredFragments.map(fragment => fragment.content)),
        imports: mergeImportMaps(filteredFragments.map(fragment => fragment.imports)),
    });
}

export function addFragmentImports(fragment: Fragment, path: Path, names: string[] | string): Fragment {
    return Object.freeze({ ...fragment, imports: addToImportMap(fragment.imports, path, names) });
}

// Code generation helper functions
export function getJsDocFragment(docs?: Docs): Fragment {
    if (!docs || docs.length === 0) return createFragment('');
    const lines = ['/**', ...docs.map(line => ` * ${line}`), ' */'];
    return createFragment(lines.join('\n'));
}

export function getImportsFragment(imports: ImportMap, pathOverrides: PathOverrides = {}): Fragment {
    const statements = getImportStatements(imports, pathOverrides);
    if (statements.length === 0) return createFragment('');
    return createFragment(statements.join('\n'));
}

export function getCodeFileFragment(fragments: Fragment[], pathOverrides: PathOverrides = {}): Fragment {
    const merged = mergeFragments(fragments, cs => cs.join('\n\n'));
    const importsFragment = getImportsFragment(merged.imports, pathOverrides);

    if (importsFragment.content.length === 0) {
        return merged;
    }

    return createFragment(`${importsFragment.content}\n\n${merged.content}`);
}

// md based Fragment Functions
export function getFrontmatterFragment(title: string, description: string): Fragment {
    return fragment`---\ntitle: ${title}\ndescription: ${description}\n---`;
}

export function getTitleAndDescriptionFragment(title: string, docs?: Docs): Fragment {
    return mergeFragments(
        [fragment`# ${title}`, docs && docs.length > 0 ? fragment`${docs.join('\n')}` : undefined],
        cs => cs.join('\n\n'),
    );
}

export function getCodeBlockFragment(code: Fragment, language: string = ''): Fragment {
    return mapFragmentContent(code, c => `\`\`\`${language}\n${c}\n\`\`\``);
}

export function getTableFragment(headers: (Fragment | string)[], rows: (Fragment | string)[][]): Fragment {
    const toFragment = (cell: Fragment | string) => (typeof cell === 'string' ? createFragment(cell) : cell);
    const headerFragments = headers.map(toFragment);
    const rowFragments = rows.map(row => row.map(toFragment));
    const colWidths = headerFragments.map((header, colIndex) =>
        Math.max(header.content.length, ...rowFragments.map(row => row[colIndex]?.content?.length ?? 0)),
    );
    const padCells = (f: Fragment, colIndex: number) => mapFragmentContent(f, c => c.padEnd(colWidths[colIndex] ?? 0));
    const mergeCells = (fs: Fragment[]) => mergeFragments(fs, cs => cs.join(' | '));
    const lines = [
        mergeCells(headerFragments.map(padCells)),
        mergeCells(headerFragments.map((_, colIndex) => createFragment('-'.repeat(colWidths[colIndex])))),
        ...rowFragments.map(row => mergeCells(row.map(padCells))),
    ];
    return mergeFragments(
        lines.map(line => mapFragmentContent(line, c => `| ${c} |`)),
        cs => cs.join('\n'),
    );
}

export function getCommentFragment(lines: string[]): Fragment {
    return fragment`<!--\n${lines.join('\n')}\n-->`;
}

export function getPageFragment(fragments: Fragment[]): Fragment {
    const page = mergeFragments(fragments, cs => cs.join('\n\n'));
    // const links = getImportMapLinks(page.imports, pathOverrides);
    return page;
    // return fragment`${page}\n\n## See also\n\n${links.join('\n')}`;
}
