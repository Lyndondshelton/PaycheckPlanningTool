# Paycheck Planner

A Next.js, React, and TypeScript application for forecasting cash and savings balances on transaction days. Product requirements are maintained by the project owner in `app-info.md`.

This directory is the application and npm project root. Run all commands here, not from the outer Git repository directory.

## Run locally

Use Node.js 22.18+ or Node.js 24+. Keep these server-only variables in the ignored `.env.local` file:

- `DATABASE_URL`: the Neon Postgres connection string.
- `BETTER_AUTH_SECRET`: a high-entropy authentication secret of at least 32 characters.
- `BETTER_AUTH_URL`: the app origin, such as `http://localhost:3000` in development.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Signed-out visitors go to `/login`; `/signup` creates an account. Registration is currently open, and email verification and password recovery are not configured.

Authentication and paycheck plans use Neon Postgres. Valid plan changes save automatically to the signed-in account. Open the same hosted app and sign into the same account on another device to load the saved plan. Hosting on Vercel is a separate deployment step.

## Where to make changes

| What needs changing | Start here |
| --- | --- |
| Pages, navigation, and server entry points | `app/` |
| Login, signup, session loading, and sign-out UI | `components/login/` |
| Planner forms, timeline, charts, and savings UI | `components/planner/` |
| Server authentication configuration | `lib/auth/auth.ts` |
| Browser authentication calls | `lib/auth/client.ts` |
| Server-side session verification | `lib/auth/session.ts` |
| Postgres connection pooling and timeouts | `lib/db/connection.ts` |
| Tables, columns, constraints, and indexes | A new SQL file in `lib/db/migrations/` |
| Migration runner settings | `lib/db/migrations.config.json` |
| Allowed schedules and forecast ranges | Constants at the top of `lib/planner/planner.ts`: `PAY_SCHEDULES`, `INCOME_BASES`, `BILL_SCHEDULES`, `SAVINGS_SCHEDULES`, `HORIZONS`, and `MAX_FORECAST_DAYS` |
| Plan types, validation, recurrence, and forecast calculations | `lib/planner/planner.ts` |
| Loading, autosave, retry, and unsaved-change status | `components/planner/use-plan-persistence.ts` |
| Authenticated plan HTTP requests | `app/api/plan/route.ts` |
| Plan SQL, table mapping, and transactions | `lib/db/plan-repository.ts` |
| Server-only access to the plan repository | `lib/db/plan-store.ts` |
| Save validation and normalization | `lib/planner/persistence.ts` |
| Importing old browser plans | `lib/planner/storage.ts` |
| Money and date display formatting | `lib/formatting/format.ts` |
| Shared base styling | `app/globals.css` |
| Forecast-specific styling | `components/planner/forecast.css` |
| Unit tests | `tests/` |
| Setup and behavior documentation | `docs/` |

Keep interactive UI in `components/`, domain calculations in `lib/planner/`, and server-only database access in `lib/db/`. Route files handle requests and session checks. Database writes must use the verified session's user ID.

## Structure

```text
app/                         Pages, layouts, and HTTP routes
components/
  login/                     Account UI
  planner/                   Planner UI and forecast styles
lib/
  auth/                      Server configuration, browser client, and sessions
  db/
    connection.ts            Postgres pool
    plan-repository.ts       Plan SQL, mapping, and transactions
    plan-store.ts            Server-only repository entry point
    migrations.config.json   Shared migration runner settings
    migrations/              Numbered SQL files only
  formatting/                Display helpers
  planner/                   Domain calculations, save validation, and legacy import
docs/                        Operational and product guides
tests/                       Unit tests
public/                      Static assets
```

`.next/`, `node_modules/`, `.qa/`, and `log/` contain generated output or dependencies. Application source belongs in the directories above.

## Commands

```sh
npm test
npm run lint
npm run build
```

```sh
npm run db:migrate:preview
npm run db:migrate
npm run db:migrate:create -- describe_the_change
```

Migration commands are manual and use `.env.local`. The runner records applied application migrations in `public.pgmigrations`. Preserve applied SQL files and make later changes in new migrations. No database migrations run during app startup or builds.

## Guides

- [Database connections and migrations](docs/database.md)
- [Authentication](docs/authentication.md)
- [Planner behavior and calculation rules](docs/planner.md)
- [Testing](docs/testing.md)
