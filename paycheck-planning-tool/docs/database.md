# Database connections and migrations

Paths and npm commands in this guide are relative to the Next.js project directory, `paycheck-planning-tool/`.

## Where to make changes

| Change | Location |
| --- | --- |
| Connection pooling and timeouts | `lib/db/connection.ts` |
| Plan queries, table mappings, and transaction boundaries | `lib/db/plan-repository.ts` |
| Server-only repository entry point | `lib/db/plan-store.ts` |
| Authentication and HTTP responses for plan requests | `app/api/plan/route.ts` |
| Save validation and normalized plan format | `lib/planner/persistence.ts` |
| Browser load/save status and retry behavior | `components/planner/use-plan-persistence.ts` |
| Application tables, columns, constraints, and indexes | A new numbered SQL file in `lib/db/migrations/` |
| Migration runner directory, schema, history table, and file format | `lib/db/migrations.config.json` |
| Migration CLI entry points | The `db:migrate*` scripts in `package.json` |
| Credentials and connection URL | Ignored `.env.local`, or environment variables on the host |
| Authentication schema | Better Auth configuration in `lib/auth/auth.ts` and its own migration CLI |

The connection helper returns the application's Postgres pool. It does not create tables. Both authentication and paycheck plans use this pool. The application tables have already been migrated; no additional migration is needed for plan loading and saving.

## Why the config exists

`migrations.config.json` is optional to node-pg-migrate. This project keeps it as one place for the settings shared by the apply, preview, and create commands:

- Application migrations live in `lib/db/migrations/`.
- Application tables and migration history use the `public` schema.
- Applied migrations are recorded in `public.pgmigrations`.
- New migration files use SQL and sequential numeric prefixes.

The npm scripts pass `--envPath .env.local` separately so dotenv loads `DATABASE_URL` before the runner reads its configuration. Existing shell environment variables take precedence over dotenv values. The JSON config contains no credentials.

The migrations folder contains only executable numbered SQL files. Documentation belongs in `docs/`; no documentation ignore pattern is needed.

## Commands

Preview pending SQL:

```sh
npm run db:migrate:preview
```

Apply pending migrations:

```sh
npm run db:migrate
```

Create the next numbered SQL template:

```sh
npm run db:migrate:create -- describe_the_change
```

Review and fill in the generated SQL before applying it. Generated templates contain Up and Down markers. For a forward-only migration, remove the unused Down section. The initial migration has no Down section, and this project has no rollback command configured.

## Applied migrations

`001_create_tables.sql` is already applied. Preserve its filename and contents. Make subsequent schema changes in a new numbered file; do not edit `001` or rerun its statements manually.

The runner checks `public.pgmigrations`, executes pending files in order, and records successful migrations. It uses a shared transaction by default. Keep `BEGIN` and `COMMIT` out of the SQL files so the runner can manage that transaction. Migration commands do not run as part of application startup, builds, or page requests.

With installed node-pg-migrate 9.0.0, preview connects to the database and may initialize or repair its tracking table. It does not apply the application SQL or mark pending application migrations as applied. Preview prints SQL; it does not validate that SQL by executing it.

Better Auth's migration command manages the authentication schema independently; it does not execute application migration files.

## Schema and planner mapping

| Table | Saved planner data |
| --- | --- |
| `income_settings` | Income amount/basis, pay schedule, next payday, and semimonthly days |
| `recurring_bills` | Recurring bill definitions |
| `one_time_purchases` | One-time purchases |
| `savings` | Opening savings balance and optional goal |
| `savings_contributions` | Planned savings contribution schedules |
| `planner_settings` | Opening cash balance, forecast start date, selected range, and custom target |
| `savings_coverage_selections` | Dates selected for savings coverage; transfer amounts are recalculated |

Amounts are stored in integer cents. Application currency inputs are decimal strings. The repository converts between these formats and maps `selected_range` text to a numeric preset or `custom`. Date reads use `to_char(..., 'YYYY-MM-DD')` so PostgreSQL calendar dates do not shift with server time zones. An empty savings goal or custom target maps to SQL `NULL`.

The tables allow one income and savings configuration per user, distinct bill and contribution names within an account, and distinct purchase name/date pairs within an account. The UI and API enforce these case-sensitive rules after trimming names.

## Reading and saving a plan

`GET /api/plan` returns `{ plan, version, accountId }`. A completely empty account returns `null` for both plan and version. Partial existing data is treated as an error, preventing a browser import from overwriting an incomplete database plan. Reads use one client in a repeatable-read, read-only transaction to obtain a consistent snapshot across all seven tables.

`PUT /api/plan` accepts `{ plan, version, accountId }`. Both endpoints verify the session. The API derives query ownership exclusively from that session; the submitted account ID is only checked to prevent an old tab from saving after a different account signs in. Writes also require a matching Origin header. Responses use `Cache-Control: private, no-store`.

The repository validates and normalizes the plan, then starts a transaction on one pooled client. It locks the account's Better Auth `user` row, reads the current plan, and compares its version to the submitted version. Versions are SHA-256 hashes of normalized data, so no revision column or migration is needed. The lock serializes this application's saves, including the first save. A stale version returns HTTP 409 before changing any table.

Singleton settings use `INSERT ... ON CONFLICT (user_id) DO UPDATE`. Bills, purchases, contributions, and coverage dates are replaced for that user in the same transaction. These rows describe the current plan, not a payment history. Failure rolls back every table; the client is always released. A successful response supplies the next version.

The existing collection primary keys are globally unique TEXT columns. Stored IDs use `<user ID length>:<user ID>:<planner row ID>` to avoid collisions when two accounts import the same example IDs. Loading removes that prefix; names and planner IDs remain unchanged in the UI. Unprefixed existing IDs can also be read and receive the prefix on their next save.

All values use SQL parameters. Fixed table names live in the repository; no caller-supplied table names or SQL fragments are interpolated. Browser code never imports the credential-bearing database connection.

This implementation saves complete plans and performs one statement per collection entry. If plans become large, batch inserts can be introduced inside the repository without changing the forms or API contract. Other devices load the latest plan when opening or reloading the page; live updates and offline synchronization are not implemented.
