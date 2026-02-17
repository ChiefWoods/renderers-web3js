import { deleteDirectory, mapRenderMapContentAsync, writeRenderMap } from '@codama/renderers-core';
import { rootNodeVisitor, visit } from '@codama/visitors-core';

import { getCodeFormatter, RenderOptions } from '../utils';
import { getRenderMapVisitor } from './getRenderMapVisitor';

export function renderVisitor(path: string, options: RenderOptions = {}) {
    return rootNodeVisitor(async root => {
        // Delete existing generated folder.
        if (options.deleteFolderBeforeRendering ?? true) {
            deleteDirectory(path);
        }

        // Render the new files.
        let renderMap = visit(root, getRenderMapVisitor(options));

        // Format generated source files, unless explicitly disabled.
        const formatCode = await getCodeFormatter(options);
        renderMap = await mapRenderMapContentAsync(renderMap, formatCode);

        writeRenderMap(renderMap, path);
    });
}
