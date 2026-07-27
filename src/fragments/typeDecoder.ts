import { Fragment, fragment, getDocblockFragment, NameApi, TypeManifest, use } from '../utils';

export function getTypeDecoderFragment(scope: {
    docs?: string[];
    manifest: Pick<TypeManifest, 'decoder'>;
    name: string;
    nameApi: NameApi;
}): Fragment {
    const { name, manifest, nameApi, docs = [] } = scope;
    const decoderFunction = nameApi.decoderFunction(name);
    const strictName = nameApi.dataType(name);

    const docblock = getDocblockFragment(docs, true);
    const decoderType = use('type Decoder', 'codecs');

    return fragment`${docblock}export function ${decoderFunction}(): ${decoderType}<${strictName}> {
    return ${manifest.decoder};
}`;
}
