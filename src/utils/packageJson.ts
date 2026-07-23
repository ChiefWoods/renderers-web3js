import { CODAMA_ERROR__RENDERERS__MISSING_DEPENDENCY_VERSIONS, CodamaError, logWarn } from '@codama/errors';
import { fileExists, joinPath, readJson, RenderMap, writeFile } from '@codama/renderers-core';
import { lt as ltVersion, minVersion, subset } from 'semver';

import type { CodeFormatter } from './formatCode';
import { Fragment, mergeFragments } from './fragment';
import { getExternalDependencies } from './importMap';

type DependencyVersions = Record<string, string>;

type PackageJson = {
    author?: string;
    dependencies?: DependencyVersions;
    description?: string;
    devDependencies?: DependencyVersions;
    files?: string[];
    keywords?: string[];
    main?: string;
    name?: string;
    peerDependencies?: DependencyVersions;
    scripts?: Record<string, string>;
    version?: string;
};

export const DEFAULT_DEPENDENCY_VERSIONS: DependencyVersions = {
    '@solana/codecs': '^3.0.3',
    '@solana/web3.js': '3.0.0-rc.2',
};

export async function syncPackageJson(
    renderMap: RenderMap<Fragment>,
    formatCode: CodeFormatter,
    packageFolder: string,
    options: {
        dependencyMap?: Record<string, string>;
        dependencyVersions?: Record<string, string>;
        syncPackageJson?: boolean;
    },
): Promise<void> {
    const shouldSyncPackageJson = options.syncPackageJson ?? true;
    const packageJsonPath = joinPath(packageFolder, 'package.json');
    const usedDependencies = getUsedDependencyVersions(renderMap, options.dependencyVersions ?? {});

    if (!shouldSyncPackageJson) {
        if (fileExists(packageJsonPath)) {
            checkExistingPackageJson(readJson(packageJsonPath), usedDependencies);
        }
        return;
    }

    if (fileExists(packageJsonPath)) {
        const packageJson = updateExistingPackageJson(readJson(packageJsonPath), usedDependencies);
        await writePackageJson(packageJson, packageJsonPath, formatCode);
    } else {
        const packageJson = createNewPackageJson(usedDependencies);
        await writePackageJson(packageJson, packageJsonPath, formatCode);
    }
}

export function createNewPackageJson(dependencyVersions: DependencyVersions): PackageJson {
    return updateExistingPackageJson(
        {
            name: 'js-client',
            version: '1.0.0',
            description: '',
            main: 'src/index.ts',
            files: ['./dist/src', './dist/types', './src/'],
            scripts: { test: 'echo "Error: no test specified" && exit 1' },
            keywords: [],
            author: '',
        },
        dependencyVersions,
    );
}

export function updateExistingPackageJson(
    packageJson: PackageJson,
    dependencyVersions: DependencyVersions,
): PackageJson {
    const updatedDependencies = { ...packageJson.dependencies };
    const updatedPeerDependencies = { ...packageJson.peerDependencies };
    const updatedDevDependencies = { ...packageJson.devDependencies };

    for (const [dependency, requiredRange] of Object.entries(dependencyVersions)) {
        let found = false;
        if (updatedDependencies[dependency]) {
            updateDependency(updatedDependencies, dependency, requiredRange);
            found = true;
        }
        if (updatedPeerDependencies[dependency]) {
            updateDependency(updatedPeerDependencies, dependency, requiredRange);
            found = true;
        }
        if (updatedDevDependencies[dependency]) {
            updateDependency(updatedDevDependencies, dependency, requiredRange);
            found = true;
        }
        if (!found) {
            updatedDependencies[dependency] = requiredRange;
        }
    }

    return {
        ...packageJson,
        ...(Object.entries(updatedPeerDependencies).length > 0 ? { peerDependencies: updatedPeerDependencies } : {}),
        ...(Object.entries(updatedDependencies).length > 0 ? { dependencies: updatedDependencies } : {}),
        ...(Object.entries(updatedDevDependencies).length > 0 ? { devDependencies: updatedDevDependencies } : {}),
    };
}

export function checkExistingPackageJson(packageJson: PackageJson, dependencyVersions: DependencyVersions): void {
    const missingDependencies: string[] = [];
    const dependenciesToUpdate: string[] = [];
    const existingDependencies = {
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.dependencies,
    };

    for (const [dependency, requiredRange] of Object.entries(dependencyVersions)) {
        if (!existingDependencies[dependency]) {
            missingDependencies.push(dependency);
        } else if (shouldUpdateRange(dependency, existingDependencies[dependency], requiredRange)) {
            dependenciesToUpdate.push(dependency);
        }
    }

    if (missingDependencies.length === 0 && dependenciesToUpdate.length === 0) return;
    const missingList = missingDependencies.map(d => `- ${d} missing: ${dependencyVersions[d]}\n`).join('');
    const outdatedList = dependenciesToUpdate
        .map(d => `- ${d} outdated: ${existingDependencies[d]} -> ${dependencyVersions[d]}\n`)
        .join('');
    logWarn(
        `The following dependencies in your \`package.json\` are out-of-date or missing:\n` +
            `${missingList}${outdatedList}`,
    );
}

export function getUsedDependencyVersions(
    renderMap: RenderMap<Fragment>,
    dependencyVersions: Record<string, string>,
): DependencyVersions {
    const dependencyVersionsWithDefaults = {
        ...DEFAULT_DEPENDENCY_VERSIONS,
        ...dependencyVersions,
    };

    const fragment = mergeFragments([...renderMap.values()], () => '');
    const usedDependencies = getExternalDependencies(fragment.imports);

    const [usedDependencyVersion, missingDependencies] = [...usedDependencies].reduce(
        ([acc, missing], dependency) => {
            const version = dependencyVersionsWithDefaults[dependency];
            if (version) {
                acc[dependency] = version;
            } else {
                missing.add(dependency);
            }
            return [acc, missing];
        },
        [{} as DependencyVersions, new Set<string>()],
    );

    if (missingDependencies.size > 0) {
        throw new CodamaError(CODAMA_ERROR__RENDERERS__MISSING_DEPENDENCY_VERSIONS, {
            dependencies: [...missingDependencies],
            message: 'Please add these dependencies to the `dependencyVersions` option.',
        });
    }

    return usedDependencyVersion;
}

export function shouldUpdateRange(dependency: string, currentRange: string, requiredRange: string): boolean {
    try {
        if (subset(currentRange, requiredRange)) {
            return false;
        }

        const minRequiredVersion = minVersion(requiredRange);
        const minCurrentVersion = minVersion(currentRange);
        if (!minCurrentVersion || !minRequiredVersion) {
            throw new Error('Could not determine minimum versions.');
        }

        return ltVersion(minCurrentVersion, minRequiredVersion);
    } catch (error) {
        console.warn(
            `Could not parse the following ranges for dependency "${dependency}":` +
                ` [${currentRange}] and/or [${requiredRange}].` +
                ` Caused by: ${(error as Error).message}`,
        );
        return false;
    }
}

function updateDependency(dependencyGroup: Record<string, string>, dependency: string, requiredRange: string) {
    const currentRange = dependencyGroup[dependency];
    if (!shouldUpdateRange(dependency, currentRange, requiredRange)) return;
    dependencyGroup[dependency] = requiredRange;
}

async function writePackageJson(
    packageJson: PackageJson,
    packageJsonPath: string,
    formatCode: CodeFormatter,
): Promise<void> {
    const packageJsonContent = JSON.stringify(packageJson, null, 2) + '\n';
    const formattedContent = await formatCode(packageJsonContent);
    writeFile(packageJsonPath, formattedContent);
}
