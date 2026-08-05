import type { Configuration } from 'lint-staged';

const config: Configuration = {
    '*.{js,jsx,ts,tsx,mjs,cjs}': ['bun run lint:fix', 'bun run format'],
};

export default config;
