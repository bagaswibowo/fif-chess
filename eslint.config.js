module.exports = {
  root: ['/opt/data/projects/active/jev-chess'],
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['/node_modules/', '/dist/', '/coverage/'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'warn',
  },
};
