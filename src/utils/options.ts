import type { PrettierOptions } from './formatCode';

export type RenderOptions = RenderMapOptions & {
    deleteFolderBeforeRendering?: boolean;
    formatCode?: boolean;
    packageFolder?: string;
    prettierOptions?: PrettierOptions;
};

export type RenderMapOptions = {
    extension?: string;
    indexFilename?: string;
    typeIndent?: string;
};
