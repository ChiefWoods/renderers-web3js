import type { CustomDataOptions } from './customData';
import type { OxfmtOptions } from './formatCode';
import type { PathOverrides } from './importMap';
import type { LinkOverrides } from './linkOverrides';
import type { NameTransformers } from './nameTransformers';

export type RenderOptions = RenderMapOptions & {
    deleteFolderBeforeRendering?: boolean;
    formatCode?: boolean;
    oxfmtOptions?: OxfmtOptions;
    /** Path appended to the first renderVisitor argument. Defaults to `'src/generated'`. Pass `''` to write directly to that path. */
    packageFolder?: string;
    syncPackageJson?: boolean;
};

export type RenderMapOptions = {
    asyncResolvers?: string[];
    customAccountData?: CustomDataOptions[];
    customInstructionData?: CustomDataOptions[];
    dependencyMap?: PathOverrides;
    internalNodes?: string[];
    linkOverrides?: LinkOverrides;
    nameTransformers?: Partial<NameTransformers>;
    renderParentInstructions?: boolean;
};
