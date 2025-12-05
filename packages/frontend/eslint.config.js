import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import babelParser from "@babel/eslint-parser";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      "src/assets/**",
      "*.config.js",
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
    ],
  },
  js.configs.recommended,
  ...compat.extends(
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended"
  ),
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"],
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/jsx-uses-vars": "error",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
        },
      ],
      "arrow-body-style": "off",
      "prefer-arrow-callback": "off",
      "arrow-parens": "off",
      quotes: ["error", "double"],
      "comma-dangle": [
        "error",
        {
          arrays: "always-multiline",
          objects: "always-multiline",
          imports: "always-multiline",
          exports: "always-multiline",
          functions: "never",
        },
      ],
      "react/display-name": "off",
      "func-names": "off",
      "function-paren-newline": "off",
      indent: ["error", 2],
      "new-cap": "off",
      "no-plusplus": "off",
      "no-return-assign": "off",
      "quote-props": "off",
      "template-curly-spacing": "off",
      "import/no-named-as-default": "off",
      "jsx-a11y/anchor-is-valid": "off",
      "linebreak-style": "off",
      "no-unused-expressions": "off",
      "no-async-promise-executor": "off",
      "no-use-before-define": "off",
      "no-case-declarations": "off",
      "no-console": "off",
      "no-continue": "off",
      "no-await-in-loop": "off",
      "no-nested-ternary": "off",
      "no-bitwise": "off",
      "react/prop-types": "off",
      "react-hooks/set-state-in-effect": "warn",
      "import/extensions": "off",
      "import/no-extraneous-dependencies": "off",
      "import/no-unresolved": "off",
      "import/prefer-default-export": "off",
    },
  },
];
