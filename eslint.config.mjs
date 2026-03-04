import unusedImports from "eslint-plugin-unused-imports";
import tsParser from "@typescript-eslint/parser";

/** @type {import("eslint").Linter.Config[]} */
const config = [
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "unused-imports": unusedImports,
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
                },
            ],
        },
    },
];

export default config;
