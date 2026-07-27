import { Fragment, fragment, getDocblockFragment, mergeFragments, NameApi, TypeManifest, use } from '../utils';
import { getTypeDecoderFragment } from './typeDecoder';
import { getTypeEncoderFragment } from './typeEncoder';

export function getTypeCodecFragment(scope: {
    codecDocs?: string[];
    decoderDocs?: string[];
    encoderDocs?: string[];
    manifest: Pick<TypeManifest, 'decoder' | 'encoder'>;
    name: string;
    nameApi: NameApi;
}): Fragment {
    const { codecDocs = [], name, nameApi } = scope;
    const codecFunction = nameApi.codecFunction(name);
    const decoderFunction = nameApi.decoderFunction(name);
    const encoderFunction = nameApi.encoderFunction(name);
    const looseName = nameApi.dataArgsType(name);
    const strictName = nameApi.dataType(name);

    const docblock = getDocblockFragment(codecDocs, true);
    const codecType = use('type Codec', 'codecs');

    return mergeFragments(
        [
            getTypeEncoderFragment({ ...scope, docs: scope.encoderDocs }),
            getTypeDecoderFragment({ ...scope, docs: scope.decoderDocs }),
            fragment`${docblock}export function ${codecFunction}(): ${codecType}<${looseName}, ${strictName}> {
    return ${use('combineCodec', 'codecs')}(${encoderFunction}(), ${decoderFunction}());
}`,
        ],
        renders => renders.join('\n\n'),
    );
}
