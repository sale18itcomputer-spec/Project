# Integrations

This document outlines the external services and APIs integrated into this project.

## Database & Authentication
- **Supabase** (`@supabase/supabase-js`, `^2.88.0`): Used as the primary backend for database operations and authentication. Instantiated via `lib/supabase.ts`.

## AI & Machine Learning
- **Google GenAI** (`@google/genai`, `latest`): Used for generative AI capabilities within the application logic.

## Storage
- **IndexedDB** (`idb`, `8.0.0`): Local browser database for robust offline caching or local state persistence.
