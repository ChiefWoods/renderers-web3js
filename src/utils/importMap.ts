import { joinPath, Path } from '@codama/renderers-core';

export type ImportMap = ReadonlyMap<Path, ReadonlySet<string>>;

export function createImportMap(imports: [Path, string[] | string][] = []): ImportMap {
    return Object.freeze(
        new Map(imports.map(([path, names]) => [path, new Set(typeof names === 'string' ? [names] : names)])),
    );
}

export function addToImportMap(map: ImportMap, path: Path, names: string[] | string): ImportMap {
    return mergeImportMaps([map, createImportMap([[path, names]])]);
}

export function mergeImportMaps(importMaps: ImportMap[]): ImportMap {
    const merged = new Map(importMaps[0]);
    for (const map of importMaps.slice(1)) {
        for (const [key, value] of map) {
            merged.set(key, new Set([...(merged.get(key) ?? []), ...value]));
        }
    }
    return Object.freeze(merged);
}

export type PathOverrides = Record<Path, Path>;

export function getImportStatements(importMap: ImportMap, pathOverrides: PathOverrides = {}): string[] {
    const resolved = resolvePaths(importMap, pathOverrides);
    const statements: string[] = [];

    for (const [path, names] of resolved.entries()) {
        const sortedNames = [...names].sort();
        if (sortedNames.length === 0) continue;

        if (sortedNames.length === 1) {
            statements.push(`import { ${sortedNames[0]} } from '${path}';`);
        } else {
            statements.push(`import { ${sortedNames.join(', ')} } from '${path}';`);
        }
    }

    return statements.sort();
}

// export function getImportMapLinks(importMap: ImportMap, pathOverrides: PathOverrides = {}): string[] {
//     return [...resolvePaths(importMap, pathOverrides).entries()].flatMap(([path, names]) =>
//         [...names].map(name => `- [${name}](${joinPath(path, camelCase(name))}.md)`),
//     );
// }

function resolvePaths(importMap: ImportMap, pathOverrides: PathOverrides = {}): ImportMap {
    const DEFAULT_PATH_OVERRIDES: PathOverrides = {
        'buffer-layout': '@solana/buffer-layout',
        codecs: '@solana/codecs',
        generatedAccounts: joinPath('..', 'accounts'),
        generatedHelpers: joinPath('..', 'helpers'),
        generatedInstructions: joinPath('..', 'instructions'),
        generatedPdas: joinPath('..', 'pdas'),
        generatedTypes: joinPath('..', 'types'),
        hooked: joinPath('..', '..', 'hooked'),
        web3: '@solana/web3.js',
    };

    pathOverrides = { ...DEFAULT_PATH_OVERRIDES, ...pathOverrides };
    const newEntries = [...importMap.entries()].map(([path, names]) => {
        const directOverride = pathOverrides[path];
        if (directOverride) {
            return [directOverride, names] as const;
        }

        // Support direct subpath imports so generated files can target concrete modules
        // (e.g. generatedTypes/foo -> ../types/foo) instead of going through barrel exports.
        const generatedPrefixes: Path[] = [
            'generatedTypes',
            'generatedAccounts',
            'generatedInstructions',
            'generatedPdas',
            'generatedHelpers',
        ];

        for (const prefix of generatedPrefixes) {
            const prefixWithSlash = `${prefix}/`;
            if (path.startsWith(prefixWithSlash)) {
                const base = pathOverrides[prefix] ?? prefix;
                const suffix = path.slice(prefixWithSlash.length);
                return [joinPath(base, suffix), names] as const;
            }
        }

        return [path, names] as const;
    });

    return Object.freeze(new Map(newEntries));
}
