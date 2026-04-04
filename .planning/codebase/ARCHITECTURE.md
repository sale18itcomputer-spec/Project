# Architecture

This document describes the high-level architecture of the `limperial-project-dashboard`.

## Overview
The application is a full-stack Next.js project utilizing the App Router architecture. It heavily leverages React Server Components combined with client-side interactive islands where necessary.

## Data Flow
- **Frontend requests:** Components render and request data through specialized service files (`services/api.ts`, `services/b2bDb.ts`).
- **Backend/DB calls:** The service layer interacts with Supabase, executing queries or calling Edge Functions/RPCs.
- **State Management:** Uses React Contexts (`contexts/`) and custom hooks (`hooks/`) to distribute application state globally where appropriate (e.g., authentication state).

## Separation of Concerns
1. **Pages (`app/`):** Responsible for routing and top-level layouts. Separated logically into `(auth)` for unauthenticated login flows and `(dashboard)` for authenticated business logic.
2. **UI (`components/`):** Broken down by domain or specialized UI patterns (e.g., `charts/`, `modals/`, `ui/`).
3. **Logic & API (`services/`):** Houses functions to call external services and databases.
4. **Utilities & Clients (`lib/`):** Contains pure functions, Supabase clients, and heavy specialized logic like PDF templating (`pdfTemplate.ts`).
