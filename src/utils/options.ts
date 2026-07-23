import type { CustomDataOptions } from './customData';
import type { OxfmtOptions } from './formatCode';

export type RenderOptions = RenderMapOptions & {
    deleteFolderBeforeRendering?: boolean;
    formatCode?: boolean;
    oxfmtOptions?: OxfmtOptions;
    /** Path appended to the first renderVisitor argument. Defaults to `'src/generated'`. Pass `''` to write directly to that path. */
    packageFolder?: string;
};

export type RenderMapOptions = {
    customAccountData?: CustomDataOptions[];
};
