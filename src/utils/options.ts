import type { OxfmtOptions } from './formatCode';

export type RenderOptions = RenderMapOptions & {
    deleteFolderBeforeRendering?: boolean;
    formatCode?: boolean;
    oxfmtOptions?: OxfmtOptions;
    packageFolder?: string;
};

export type RenderMapOptions = {
    extension?: string;
    indexFilename?: string;
    typeIndent?: string;
};
