import antfu from '@antfu/eslint-config';

export default antfu(
  { stylistic: false },
  {
    // Prettier incompatibility
    'eslintunicorn/number-literal-case': 'off',
  },
);
