import { Fragment, fragment, getDocblockFragment, NameApi, TypeManifest, use } from '../utils';

export function getTypeEncoderFragment(scope: {
    docs?: string[];
    manifest: Pick<TypeManifest, 'encoder'>;
    name: string;
    nameApi: NameApi;
}): Fragment {
    const { name, manifest, nameApi, docs = [] } = scope;
    const encoderFunction = nameApi.encoderFunction(name);
    const looseName = nameApi.dataArgsType(name);

    const docblock = getDocblockFragment(docs, true);
    const encoderType = use('type Encoder', 'codecs');

    return fragment`${docblock}export function ${encoderFunction}(): ${encoderType}<${looseName}> {
    return ${manifest.encoder};
}`;
}
