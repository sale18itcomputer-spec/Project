# Concerns & Technical Debt

This document tracks known architectural issues, tech debt, and fragile areas in the codebase.

## 1. Lack of Automated Tests
**Concern:** There is no testing framework (Jest, Vitest, Playwright) implemented.
**Impact:** Modifications to data service functions (`api.ts`, `b2bDb.ts`) and PDF exporters (`pdfTemplate.ts`) risk regression errors.

## 2. Heavy PDF Logic
**Concern:** `lib/pdfTemplate.ts` is notably large (~29KB).
**Impact:** It may become difficult to maintain as business requirements grow. Consider breaking this file down into smaller composable template processors or utilities if possible.

## 3. Multiple Utility Files
**Concern:** There is both a `lib/utils.ts` and a `utils/` directory.
**Impact:** Could create confusion about where helper functions should be placed. Consider consolidating all utilities into a single canonical `src/utils` or `lib/utils` location.
