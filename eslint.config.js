// @ts-check
import eslintJs from '@eslint/js';
import globals from 'globals';
import tsEslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tsEslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'],
  },

  eslintJs.configs.recommended,
  tsEslint.configs.recommended,

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      // Underscore prefix marks intentionally unused bindings (same convention
      // tsc's noUnusedLocals/noUnusedParameters accept).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      // Pre-existing violations at adoption time; downgraded so `npm run lint`
      // gates new errors without a mass edit. Raise back to 'error' once fixed.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Production code logs through src/drawio/logger.ts (debug only in dev builds); warnings and
      // errors may go to the console directly.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // ---- Module boundaries (eslint-plugin-boundaries): core <- document <- features <- ui shell.
  // A layer may import its own layer and the layers to its left. Listed exceptions are the current
  // reality, each with a TODO; new code must not add to them.
  //   core     maxGraph setup and formats: src/core, src/format, src/drawio-shapes, src/shapes,
  //            src/security, src/drawio (logger), src/config
  //   document the open diagram (DiagramDocument) and its model services: src/document, src/services
  //   features railway (the domain base: other features may use it), scenarios, railway-script,
  //            railml, ai, share, print (its UI part src/print/ui is ui)
  //   ui       the shell: src/ui, src/boot (composition), src/debug, src/main*.ts
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/__tests__/**'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
      'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
      'boundaries/ignore': ['src/**/__tests__/**'],
      'boundaries/elements': [
        // TODO(layers): feature UI glue (panels, dialogs, install-* wiring) that uses the UI shell;
        // move it to src/ui or pass what it needs through AppContext.
        {
          type: 'feature-glue',
          mode: 'full',
          pattern: [
            'src/ai/app-target.ts',
            'src/ai/template-tools.ts',
            'src/ai/tools.ts',
            'src/railml/railml-ui.ts',
            'src/railway-script/script-ui.ts',
            'src/railway-script/session.ts',
            'src/scenarios/install-scenarios.ts',
            'src/scenarios/scenario-view.ts',
            'src/scenarios/scenarios-panel.ts',
            'src/share/install-sharing.ts',
            'src/share/ui/**',
          ],
        },
        // TODO(layers): renumbers pasted railway objects (railway/clone); make it a registered paste hook
        { type: 'document-railway', mode: 'full', pattern: ['src/services/clipboard-service.ts'] },
        {
          type: 'core',
          mode: 'full',
          pattern: ['src/core/**', 'src/format/**', 'src/drawio-shapes/**', 'src/shapes/**', 'src/security/**', 'src/drawio/**', 'src/config/**'],
        },
        { type: 'document', mode: 'full', pattern: ['src/document/**', 'src/services/**'] },
        // print sheets: the feature in src/print, its dialogs / canvas overlay / exports (shell UI) in src/print/ui
        { type: 'ui', mode: 'full', pattern: ['src/print/ui/**'] },
        { type: 'feature', mode: 'full', pattern: 'src/(ai|print|railml|railway|railway-script|scenarios|share)/**', capture: ['family'] },
        { type: 'ui', mode: 'full', pattern: ['src/ui/**', 'src/boot/**', 'src/debug/**', 'src/main.ts', 'src/main-editor.ts'] },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message: 'Layer violation (core <- document <- features <- ui): see the boundaries block in eslint.config.js',
          rules: [
            { from: ['core'], allow: ['core'] },
            { from: ['document'], allow: ['core', 'document', 'document-railway'] },
            { from: ['document-railway'], allow: ['core', 'document', ['feature', { family: 'railway' }]] },
            // features: core, document, their own family, and railway (the domain base)
            {
              from: ['feature', 'feature-glue'],
              allow: ['core', 'document', 'document-railway', ['feature', { family: '${from.family}' }], ['feature', { family: 'railway' }]],
            },
            // TODO(layers): cross-feature imports of the current code (should go through the bus or core)
            { from: [['feature', { family: 'ai' }]], allow: [['feature', { family: 'scenarios' }], ['feature', { family: 'railway-script' }], ['feature', { family: 'railml' }], ['feature', { family: 'share' }]] },
            { from: [['feature', { family: 'share' }]], allow: [['feature', { family: 'scenarios' }], ['feature', { family: 'railway-script' }]] },
            { from: [['feature', { family: 'scenarios' }]], allow: [['feature', { family: 'share' }]] },
            { from: [['feature', { family: 'railway-script' }]], allow: [['feature', { family: 'railml' }]] },
            // TODO(layers): features name UI types (TabManager, ...) in their install signatures; use AppContext interfaces
            { from: ['feature'], allow: ['ui'], importKind: 'type' },
            // TODO(layers): the feature UI glue above may use the UI shell and any feature
            { from: ['feature-glue'], allow: ['ui', 'feature', 'feature-glue'] },
            { from: ['feature'], allow: ['feature-glue'] },
            { from: ['ui'], allow: ['core', 'document', 'document-railway', 'feature', 'feature-glue', 'ui'] },
          ],
        },
      ],
    },
  },

  {
    files: ['src/**/__tests__/**/*.ts'],
    languageOptions: {
      globals: globals.vitest,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  }
);
