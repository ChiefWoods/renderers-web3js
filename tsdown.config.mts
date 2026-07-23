import { env } from 'node:process';

import { defineConfig, type Format, type UserConfig } from 'tsdown';

type Platform = 'browser' | 'node' | 'react-native';

type BuildOptions = {
    format: Format;
    platform: Platform;
};

export default defineConfig([
    getBuildConfig({ format: 'cjs', platform: 'node' }),
    getBuildConfig({ format: 'esm', platform: 'node' }),
    getBuildConfig({ format: 'cjs', platform: 'browser' }),
    getBuildConfig({ format: 'esm', platform: 'browser' }),
    getBuildConfig({ format: 'esm', platform: 'react-native' }),
]);

function getBuildConfig(options: BuildOptions): UserConfig {
    const { format, platform } = options;
    return {
        clean: false,
        define: {
            __BROWSER__: `${platform === 'browser'}`,
            __ESM__: `${format === 'esm'}`,
            __NODEJS__: `${platform === 'node'}`,
            __REACTNATIVE__: `${platform === 'react-native'}`,
            __TEST__: 'false',
            __VERSION__: `"${env.npm_package_version ?? '0.0.0'}"`,
        },
        dts: false,
        entry: ['./src/index.ts'],
        format,
        name: platform,
        outExtensions({ format }) {
            return { js: `.${platform}.${format === 'cjs' ? 'cjs' : 'mjs'}` };
        },
        platform: platform === 'node' ? 'node' : 'browser',
        sourcemap: true,
    };
}
