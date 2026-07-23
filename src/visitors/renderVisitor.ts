import { deleteDirectory, mapRenderMapContentAsync, writeRenderMap } from '@codama/renderers-core';
import { rootNodeVisitor, visit } from '@codama/visitors-core';

import { getCodeFormatter, RenderOptions, syncPackageJson } from '../utils';
import { getRenderMapVisitor } from './getRenderMapVisitor';

export const DEFAULT_PACKAGE_FOLDER = 'src/generated';

export function renderVisitor(path: string, options: RenderOptions = {}) {
    return rootNodeVisitor(async root => {
        const packageFolder = options.packageFolder ?? DEFAULT_PACKAGE_FOLDER;
        const outputPath = packageFolder
            ? `${path.replace(/\/$/, '')}/${packageFolder.replace(/^\//, '')}`
            : path;

        // Delete existing generated folder.
        if (options.deleteFolderBeforeRendering ?? true) {
            deleteDirectory(outputPath);
        }

        // Render the new files.
        let renderMap = visit(root, getRenderMapVisitor(options));

        // Create or update package.json dependencies before formatting strips fragment metadata.
        const formatCode = await getCodeFormatter(options);
        await syncPackageJson(renderMap, formatCode, path, {
            dependencyMap: options.dependencyMap,
            syncPackageJson: options.syncPackageJson,
        });

        // Format generated source files, unless explicitly disabled.
        renderMap = await mapRenderMapContentAsync(renderMap, formatCode);

        writeRenderMap(renderMap, outputPath);
    });
}
