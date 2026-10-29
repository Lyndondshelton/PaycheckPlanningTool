# Authentication

Authentication code lives in `lib/auth/`, login UI in `components/login/`, and HTTP endpoints in `app/api/auth/`. Paths in this guide are relative to the Next.js project directory.

- `lib/auth/auth.ts` configures Better Auth with the Postgres pool from `lib/db/connection.ts` and email/password authentication.
- `lib/auth/client.ts` provides the browser authentication client. Requests use the app's current origin.
- `lib/auth/session.ts` validates the request's session on the server and shares the result within a render.
- Login UI belongs in `components/login/`.
- Authentication HTTP endpoints belong in `app/api/auth/`.

`app/api/auth/[...all]/route.ts` mounts Better Auth's GET and POST handlers. `/login` and `/signup` redirect authenticated users to the planner. The planner checks the session on the server before rendering and redirects signed-out users to `/login`. Session reads are wrapped in Suspense because Cache Components is enabled. `app/api/plan/route.ts` independently checks the session on every load and save, and obtains the query's user ID from that session.

Registration uses Better Auth's standard email/password signup and signs in the new account automatically. Account creation is currently open to anyone who can access the app. Email verification and password recovery are not configured. Passwords are handled by Better Auth; application code does not store credentials in browser storage. Sign-in and sign-out use a full navigation after the session cookie changes so the server checks the new state and in-memory planner state is discarded.

Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` in the app's ignored `.env.local`. Use a high-entropy secret of at least 32 characters, and set the URL to the deployed origin on Vercel. Keep all three variables server-only. Existing database migrations should already have been applied; this implementation does not run them automatically.

When running Better Auth's CLI, explicitly select `--config ./lib/auth/auth.ts`. A CLI process may fail to resolve the `server-only` marker imported by the database helper; Better Auth documents temporarily removing the marker for migration commands and restoring it afterward.

Paycheck plans save to Neon, scoped to the server-verified user ID. Old browser data is imported only if the account has no database plan; the original remains as a backup. A tab also checks that the current session still belongs to its original account before loading or saving. See `docs/database.md` for API behavior and `docs/planner.md` for save status and conflict handling.
