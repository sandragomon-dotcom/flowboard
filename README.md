# Flowboard

A team kanban board built with React, TypeScript and Vite, backed by Supabase (auth, Postgres, realtime).

## Setup

1. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLIC_CONFIG` (the publishable key).
2. `npm install`
3. `npm run dev`

## Features

- Email/password sign-in with password reset
- Custom columns; cards with assignee, priority and due date
- Drag and drop, or Shift+Arrow keys on a focused card, to move and reorder
- Search and filter, light/dark theme, realtime sync, undo for deletes

## Scripts

`npm run dev`, `npm run build`, `npm run lint`, `npm test` (run once), `npm run test:watch`

## Tests and CI

Tests use Vitest and React Testing Library. Supabase is mocked (`src/test/`), so they never touch a real database
and need no environment variables. `.github/workflows/ci.yml` runs lint, type check, tests and build on every push
and pull request. To block merges on failures, mark the `ci` check as required in your branch protection rules.

Database policies live in `supabase/migrations/`; `src/static.test.ts` checks them for row level security.
