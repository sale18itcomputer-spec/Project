# Project Structure

Overview of the directory layout and structural conventions.

## Root Directories

- `app/`: Next.js App Router entry points
  - `(auth)/`: Routes related to user authentication (Login, Register).
  - `(dashboard)/`: Authenticated main application routes.
  - `api/`: Next.js Route Handlers.
  - `globals.css`: Global styles including Tailwind imports.
- `components/`: UI components categorized by responsibility
  - `charts/`: ECharts wrappers and specialized chart components.
  - `common/`: Standard, widely used components not tied to a specific domain.
  - `dashboards/`: Domain-specific dashboard layout blocks (e.g., CRM dashboard).
  - `features/`: Complex business components.
  - `layout/`: Sidenav, Topbar, Layout wrappers.
  - `modals/`: Dialog components like `NewCompanyModal`.
  - `pdf/`: React components meant specifically for rendering PDF structures.
  - `providers/`: Context providers wrapping the application.
  - `ui/`: Atomics usually styled with Radix UI + Tailwind.
- `lib/`: Third-party instantiations and heavy utilities
  - `supabase.ts`: Supabase client initialization.
  - `pdfTemplate.ts`: Substantial logic for PDF generation.
  - `utils.ts`: Small pure utilities.
- `services/`: Data fetching and API interaction
  - `api.ts`: General API service wrappers.
  - `b2bDb.ts`: B2B specific query logic for Supabase interactions.
- `hooks/`: Custom React hooks (`use-debounce`, etc.).
- `contexts/`: React Context Definitions.
- `utils/`: Miscellaneous helper functions (in addition to `lib/utils.ts`).
- `sql/`: Raw SQL migrations or query references.
- `schemas.ts`, `types.ts`: Global TypeScript interfaces, type aliases, and Zod schemas.
