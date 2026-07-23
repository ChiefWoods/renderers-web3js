import { camelCase, capitalize, kebabCase, pascalCase, snakeCase, titleCase } from '@codama/nodes';

export type NameTransformerHelpers = {
    camelCase: (name: string) => string;
    capitalize: (name: string) => string;
    kebabCase: (name: string) => string;
    pascalCase: (name: string) => string;
    snakeCase: (name: string) => string;
    titleCase: (name: string) => string;
};

export type NameTransformer = (name: string, helpers: NameTransformerHelpers) => string;

export type NameTransformerKey =
    | 'accountDataCodec'
    | 'accountDataType'
    | 'accountDeserializeFunction'
    | 'accountFetchAllFunction'
    | 'accountFetchAllMaybeFunction'
    | 'accountFetchFunction'
    | 'accountFetchProgramAccountsFunction'
    | 'accountType'
    | 'definedType'
    | 'definedTypeCodec'
    | 'instructionAccountsType'
    | 'instructionArgsType'
    | 'instructionCreateFunction'
    | 'instructionDataCodec'
    | 'pdaFindFunction'
    | 'pdaSeedsType'
    | 'programAddressConstant';

export type NameTransformers = Record<NameTransformerKey, NameTransformer>;

export type NameApi = Record<NameTransformerKey, (name: string) => string>;

export function getNameApi(transformers: NameTransformers): NameApi {
    const helpers = {
        camelCase,
        capitalize,
        kebabCase,
        pascalCase,
        snakeCase,
        titleCase,
    };
    return Object.fromEntries(
        Object.entries(transformers).map(([key, transformer]) => [key, (name: string) => transformer(name, helpers)]),
    ) as NameApi;
}

export const DEFAULT_NAME_TRANSFORMERS: NameTransformers = {
    accountDataCodec: name => `${pascalCase(name)}AccountDataCodec`,
    accountDataType: name => `${pascalCase(name)}AccountData`,
    accountDeserializeFunction: name => `deserialize${pascalCase(name)}Account`,
    accountFetchAllFunction: name => `fetchAll${pascalCase(name)}Accounts`,
    accountFetchAllMaybeFunction: name => `fetchAllMaybe${pascalCase(name)}Accounts`,
    accountFetchFunction: name => `fetch${pascalCase(name)}Account`,
    accountFetchProgramAccountsFunction: name => `fetchProgramAccounts${pascalCase(name)}`,
    accountType: name => `${pascalCase(name)}Account`,
    definedType: name => pascalCase(name),
    definedTypeCodec: name => `${camelCase(name)}Codec`,
    instructionAccountsType: name => `${pascalCase(name)}InstructionAccounts`,
    instructionArgsType: name => `${pascalCase(name)}InstructionArgs`,
    instructionCreateFunction: name => `create${pascalCase(name)}Instruction`,
    instructionDataCodec: name => `${pascalCase(name)}InstructionDataCodec`,
    pdaFindFunction: name => `find${pascalCase(name)}Pda`,
    pdaSeedsType: name => `${pascalCase(name)}PdaSeeds`,
    programAddressConstant: name => `${name.toUpperCase()}_PROGRAM_ID`,
};
