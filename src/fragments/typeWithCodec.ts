import { Fragment, mergeFragments, NameApi, TypeManifest } from '../utils';
import { getTypeFragment } from './type';
import { getTypeCodecFragment } from './typeCodec';

export function getTypeWithCodecFragment(scope: {
    codecDocs?: string[];
    decoderDocs?: string[];
    encoderDocs?: string[];
    manifest: TypeManifest;
    name: string;
    nameApi: NameApi;
    typeDocs?: string[];
}): Fragment {
    return mergeFragments([getTypeFragment({ ...scope, docs: scope.typeDocs }), getTypeCodecFragment(scope)], renders =>
        renders.join('\n\n'),
    );
}
