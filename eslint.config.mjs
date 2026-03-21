import unusedImports from "eslint-plugin-unused-imports";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
const config = [
    {
        ignores: ["node_modules/**", ".next/**", "dist/**", "build/**"],
    },
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "unused-imports": unusedImports,
            "react-hooks": reactHooks,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
];

export default config;
