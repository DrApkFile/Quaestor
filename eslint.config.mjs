import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'contracts/**', '.accounts/**', 'apps/web/public/circuits/**'] },
  { files: ['**/*.ts', '**/*.tsx'], extends: [...tseslint.configs.strictTypeChecked],
    linterOptions: { noInlineConfig: true },
    languageOptions: { parserOptions: { project: ['./packages/*/tsconfig.json', './apps/*/tsconfig.json', './scripts/tsconfig.json', './tools/*/tsconfig.json'], tsconfigRootDir: import.meta.dirname } },
    plugins: { quaestor: { rules: { 'no-comments': { meta: { type: 'problem', schema: [] }, create(context) { return { Program() { for (const comment of context.sourceCode.getAllComments()) context.report({ loc: comment.loc, message: 'Use names instead of comments.' }); } }; } } } } },
    rules: { 'quaestor/no-comments': 'error', '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-floating-promises': 'error' },
  },
);
