import { EventNode, pascalCase, resolveNestedTypeNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    Fragment,
    fragment,
    getCodeFileFragment,
    getDiscriminatorConstantContent,
    getDiscriminatorInfos,
    getDiscriminatorValidationContent,
    PathOverrides,
} from '../utils';
import { TypeManifestVisitor } from '../visitors/getTypeManifestVisitor';

export function getEventFragment(
    node: EventNode,
    typeManifestVisitor: TypeManifestVisitor,
    dependencyMap: PathOverrides = {},
): Fragment {
    const name = pascalCase(node.name);
    const eventName = name.endsWith('Event') ? name.slice(0, -'Event'.length) : name;
    const resolvedData = resolveNestedTypeNode(node.data);
    const fields = resolvedData.kind === 'structTypeNode' ? resolvedData.fields : [];
    const discriminators = getDiscriminatorInfos(node.name, 'event', node.discriminators ?? [], fields);
    const discriminatorFieldNames = new Set(
        (node.discriminators ?? [])
            .filter(discriminator => discriminator.kind === 'fieldDiscriminatorNode')
            .map(discriminator => discriminator.name),
    );
    const publicData =
        resolvedData.kind === 'structTypeNode'
            ? { ...resolvedData, fields: resolvedData.fields.filter(field => !discriminatorFieldNames.has(field.name)) }
            : resolvedData;
    const publicManifest = visit(publicData, typeManifestVisitor);
    const wireManifest = visit(node.data, typeManifestVisitor);
    const validation = discriminators.map(info => getDiscriminatorValidationContent(info)).join('\n    ');
    const discriminatorBytesFunction = discriminators[0]
        ? `\n\nexport function get${name}DiscriminatorBytes(): Uint8Array {
    return ${discriminators[0].constantName};
}`
        : '';
    const discriminatorFields = [...discriminatorFieldNames];
    const stripFields =
        discriminatorFields.length > 0
            ? `\n    const { ${discriminatorFields.map(field => `${field}: _`).join(', ')}, ...event } = decoded;\n    return event as ${eventName};`
            : `\n    return decoded as ${eventName};`;
    const decoder =
        discriminators.length === 1 && discriminators[0].offset === 0
            ? addFragmentImports(
                  fragment`function get${eventName}Decoder() {
    return getHiddenPrefixDecoder(${publicManifest.decoder}, [getConstantDecoder(${discriminators[0].constantName})]);
}`,
                  'codecs',
                  ['getConstantDecoder', 'getHiddenPrefixDecoder'],
              )
            : fragment`function get${eventName}Decoder() {
    return ${wireManifest.decoder};
}`;

    return getCodeFileFragment(
        [
            fragment`${discriminators.map(getDiscriminatorConstantContent).join('\n\n')}
${discriminatorBytesFunction}

export type ${eventName} = ${publicManifest.strictType};

${decoder}

export function parse${eventName}(data: Uint8Array): ${eventName} {
    ${validation}
    const decoded = get${eventName}Decoder().decode(data);${stripFields}
}`,
        ],
        dependencyMap,
    );
}
