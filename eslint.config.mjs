/**
 * ESLint flat config for the Assent Chrome Extension source.
 *
 * No bundler — all files are vanilla ES modules running directly in the
 * browser, MV3 service worker, content scripts, or side panel.
 */

import js from "@eslint/js";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";

export default [
  js.configs.recommended,

  {
    files: ["extension/src/**/*.js"],
    plugins: { jsdoc },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        chrome: "readonly",
        LanguageModel: "readonly",
        LanguageDetector: "readonly",
        Translator: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      curly: ["error", "all"],
      "no-else-return": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "no-duplicate-imports": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-console": "warn",
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: { FunctionDeclaration: true },
        },
      ],
      "jsdoc/check-param-names": "warn",
    },
  },

  {
    files: ["extension/src/sidepanel/**/*.js"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "no-console": "off",
    },
  },

  {
    files: ["extension/src/content.js"],
    rules: {
      "no-console": "off",
    },
  },

  {
    ignores: ["node_modules/**", "extension/data/**", ".github/**"],
  },
];
