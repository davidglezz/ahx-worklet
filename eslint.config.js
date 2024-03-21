import antfu from '@antfu/eslint-config';

export default antfu(
  {
    stylistic: false,
    vue: false,
    ignores: [],
  },
  {
    rules: {
      // Prettier incompatibility
      'unicorn/number-literal-case': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },
  {
    files: ['**/*.bench.ts'],
    rules: {
      'test/consistent-test-it': 'off',
    },
  },
);
