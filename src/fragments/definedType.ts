import { camelCase, DefinedTypeNode } from '@codama/nodes';
import { pipe, visit } from '@codama/visitors-core';

import {
    DEFAULT_NAME_TRANSFORMERS,
    Fragment,
    getCodeFileFragment,
    getLinkImportPath,
    getNameApi,
    mergeFragments,
    NameApi,
    PathOverrides,
    removeFragmentImports,
} from '../utils';
import { TypeManifestVisitor } from '../visitors/getTypeManifestVisitor';
import { getTypeDiscriminatedUnionHelpersFragment } from './typeDiscriminatedUnionHelpers';
import { getTypeWithCodecFragment } from './typeWithCodec';

const defaultNameApi = getNameApi(DEFAULT_NAME_TRANSFORMERS);

export function getDefinedTypeFragment(
    node: DefinedTypeNode,
    typeManifestVisitor: TypeManifestVisitor,
    nameApi: NameApi = defaultNameApi,
    dependencyMap: PathOverrides = {},
): Fragment {
    const manifest = visit(node, typeManifestVisitor);
    const typeWithCodec = getTypeWithCodecFragment({
        manifest,
        name: node.name,
        nameApi,
        typeDocs: node.docs,
    });
    const helpers = getTypeDiscriminatedUnionHelpersFragment({
        name: node.name,
        nameApi,
        typeNode: node.type,
    });

    const page = pipe(
        mergeFragments([typeWithCodec, helpers], cs => cs.join('\n\n')),
        f =>
            removeFragmentImports(f, getLinkImportPath('generatedTypes', camelCase(node.name)), [
                nameApi.dataType(node.name),
                nameApi.dataArgsType(node.name),
                nameApi.encoderFunction(node.name),
                nameApi.decoderFunction(node.name),
                nameApi.codecFunction(node.name),
            ]),
    );

    return getCodeFileFragment([page], dependencyMap);
}
