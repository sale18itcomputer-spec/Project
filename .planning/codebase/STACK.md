# Tech Stack

This document outlines the core technology stack used in this project.

## Core Runtime & Frameworks
- **Framework:** Next.js `^15.1.6` (App Router)
- **UI Library:** React `^18.3.1` (with React DOM `^18.3.1`)
- **Language:** TypeScript `~5.8.2`
- **Environment:** Node.js

## Styling & Typography
- **CSS Framework:** Tailwind CSS `^4.2.1` (with `tailwindcss/postcss`, `autoprefixer`)
- **Utilities:** `tailwind-merge`, `clsx`, `class-variance-authority`
- **Icons:** `lucide-react`

## UI Components
- **Headless UI:** Radix UI components (Avatar, Dialog, Select, Popover, Dropdown Menu, etc.)
- **Charts:** Apache ECharts (`echarts`, `echarts-for-react`)
- **Rich Text:** `react-quill`
- **Notifications:** `sonner`

## Build & Tooling
- **Linting:** ESLint (`@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks`)
- **Maintenance:** Knip (unused files/exports cleaner)
- **Storage:** Local IndexedDB (`idb`)
- **Exporting:** PDF generation (`lib/pdfTemplate.ts`), Excel generation (`xlsx`)
