module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue']
  },
  extends: ['eslint:recommended', 'plugin:vue/vue3-essential'],
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist', 'node_modules', 'src-tauri'],
  rules: {
    'no-empty': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'vue/no-mutating-props': 'off',
    'vue/valid-template-root': 'off',
    'vue/multi-word-component-names': 'off'
  }
};
