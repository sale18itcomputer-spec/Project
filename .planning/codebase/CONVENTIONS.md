# Conventions

This document outlines the coding standards and conventions used in this project.

## Code Style & Linting
- **ESLint**: Standard rules enforced via `eslint.config.mjs` and the `next lint` script. Run `npm run clean:imports` to auto-fix import statements.
- **Knip**: Integrated via `npm run clean:files` to detect and remove unused files, exports, and dependencies, enforcing a lean codebase.
- **Tailwind**: Used with Radix UI primitives. `cn()` utility (`clsx` + `tailwind-merge`) is standard for conditionally passing classes.

## TypeScript
- Strict typing generally relied on.
- Global types should be placed in `types.ts`.
- Validation schemas (likely Zod based on convention) live in `schemas.ts`.

## Component Design
- Use default exports for Next.js pages/layouts inside `app/`.
- Named exports are preferred for components and utilities to prevent import mismatches and encourage better refactoring.
- Modals are kept separate in `components/modals/` for clarity and lazy-loading potential.
