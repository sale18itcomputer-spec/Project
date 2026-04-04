# Testing

Currently, there is no structured automated testing framework installed or configured in the project.

## Current State
- **Unit Testing**: No framework (Jest/Vitest) is present.
- **E2E Testing**: No framework (Cypress/Playwright) is present.
- **Type Checking**: TypeScript (`tsc`) is the primary line of defense.
- **Linting**: ESLint prevents logical errors and style violations.

## Recommendations
Before large refactors, strongly consider adding a testing suite like `Vitest` for unit tests and `Playwright` for E2E tests to validate critical business logic (such as PDF generation and database modifications).
