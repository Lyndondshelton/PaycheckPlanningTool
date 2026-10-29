# Testing

Run commands from the Next.js project directory, `paycheck-planning-tool/`.

## Standard checks

```sh
npm test
npm run lint
npm run build
```

The Node suite covers forecast calculations, calendar dates, savings coverage, validation, saved-plan compatibility, and legacy browser import. Persistence tests cover schema uniqueness rules, money/date mapping, nullable fields, account-scoped query parameters, first-save locking, stale-version rejection, and transaction rollback/release. Repository tests inject a fake pool; they do not execute PostgreSQL or create real account/plan records.

`allowImportingTsExtensions` in `tsconfig.json` permits explicit `.ts` imports between tested modules. The existing no-emit configuration lets Next.js bundle them while Node's native TypeScript support runs the tests without another loader or package.

The production build compiles and checks the Next.js app. Better Auth may validate its configured database schema while modules initialize; that is not a migration. These checks do not verify a real authenticated browser save against Neon.

## Manual authentication and database checks

Use a dedicated account: these steps intentionally create or change real records in the configured database.

1. Open `/` while signed out and confirm the redirect to `/login`. An unauthenticated `GET /api/plan` should return 401 without a plan.
2. Create an account or sign into an existing test account. Verify incorrect passwords show an error. `/login` and `/signup` should return authenticated users to the planner.
3. Enter valid income settings, add a bill, a purchase, and a savings contribution. Set a goal and select savings coverage. Wait for **Saved to your account** before reloading.
4. Reload and verify all values, dates, selections, and optional fields. Confirm an empty savings goal and a negative opening cash balance are retained.
5. Open the same app in another browser/device with the same account and check the saved plan. On Vercel, configure the same database and auth secret and set `BETTER_AUTH_URL` to the deployed origin.
6. Leave two tabs open. Save an edit in the first, then edit the second. The second should reject its stale save and offer **Reload saved plan**. The first tab's saved data must remain intact.
7. Try duplicate bill/contribution names and duplicate purchase names on the same date. Forms should reject them. Different capitalization and purchase dates should follow the documented schema rules.
8. Temporarily disconnect the browser network, change a value, and verify a save failure and retry option. Reconnect and retry. Clearing a required field should prevent saving until corrected. Closing/reloading with unsaved changes should warn.
9. Sign out, sign into another account, and verify it cannot load the first account's data. If another tab changes the signed-in account, the original tab must not save its plan into the new account.
10. For an account without database data, open a browser containing its legacy plan and verify import. Check the original browser backup remains. Once saved, later browser-backup edits must not override the database plan.
11. Check the status/retry controls at phone widths as well as desktop widths.

The previous `test:browser` command and its custom script were removed because they reset browser storage and assumed that isolated browser profiles also isolated plan data. With database persistence those assumptions no longer hold, and the script could modify a real account's plan. No replacement browser automation package has been installed.

## Generated output

- `.qa/` contains browser screenshots and local browser-check artifacts.
- `log/` contains diagnostic output and is ignored by Git.
- `.next/` contains generated Next.js build output.

These directories contain generated output, not source files to modify when changing the app.
