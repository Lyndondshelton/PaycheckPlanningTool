# Planner behavior

The planner projects cash and savings balances on transaction days. It does not connect to a bank or move money. Forecast options, types, validation, and calculations currently live in `lib/planner/planner.ts`.

## Enter a plan

1. Enter take-home income per paycheck, week, month, or year.
2. Choose a weekly, biweekly, semimonthly, or monthly pay schedule and the next payday. For semimonthly pay, choose two days of the month; 31 means month end.
3. Add recurring bills with amounts, next due dates, and weekly, monthly, semiannual, or annual schedules. Expand the saved bill list to edit or remove entries.
4. Add purchases with names, positive amounts, and dates. Each expense is deducted once. Expand the saved purchase list to edit or remove entries.
5. Set the opening cash balance and forecast start date. The balance is measured before transactions on that date; exclude deposits already reflected in it.
6. Choose 14, 28, 30, 60, or 90 days, or select Custom and a target date. The target date is included. A custom forecast can cover 1 to 365 days, as defined by `MAX_FORECAST_DAYS`. Switching to a preset retains the custom date.
7. Review the chart and transaction timeline. Negative closing balances are marked as potential overdrafts. Colors also have labels and a legend.
8. Enter opening savings and an optional goal. Add one-time, weekly, biweekly, monthly, or every-payday contributions. Savings are displayed beside the forecast on wide screens and below it on smaller screens.

An example plan is available when the planner is empty. Forms remain visible while saved transaction lists are collapsed. Lists reopen collapsed after a reload and display earliest dates first. Hiding a list preserves unfinished edits and does not change its transactions.

## Calculation rules

- Amounts use USD. Calculations use integer cents and round each paycheck to the nearest cent. Taxes are not calculated.
- Income conversion uses 52 weekly, 26 biweekly, 24 semimonthly, or 12 monthly payments per year. These are estimates; an actual per-paycheck amount is the most direct input.
- Preset forecasts include the start date and the following `range - 1` calendar days. Custom forecasts include both endpoints. Invalid, reversed, or excessive custom ranges suspend the forecast.
- Next payday and next due dates anchor recurrence. Earlier anchors establish the schedule without reapplying transactions already reflected in the opening balance.
- Weekly and biweekly paydays occur every 7 or 14 calendar days. A month may therefore contain extra paydays without extra settings fields.
- Monthly schedules keep the original day, clamp it to the last day of shorter months, and return to the original day later. A yearly February 29 bill falls on February 28 in non-leap years.
- Both semimonthly deposits occur if the scheduled days clamp onto the same month-end date.
- Purchases do not recur. Expenses outside the forecast remain saved but do not affect that window. Purchases before the start date are assumed to be included in the opening balance.
- Weekends and holidays do not shift transactions. Calendar arithmetic is independent of time zones and daylight saving changes.
- All transactions on the same date share one closing balance. The app does not estimate bank posting order or unentered spending. Spending totals include bills and purchases, and exclude savings coverage transfers.
- Opening savings and planned contributions are measured from the same forecast start date. Contributions before that date are not reapplied. Goal bars distinguish current savings from projected progress.
- Contributions do not record completed deposits, stop at the goal, or calculate interest. Update actual opening balances manually when moving the planning window forward.

## Covering shortfalls with savings

Savings remain separate until a user selects **cover with savings** for a forecast day. Coverage transfers enough projected savings to bring the closing cash balance to zero, or all available savings if that is insufficient. Remaining shortfalls stay highlighted. A negative opening cash balance also gets a coverable timeline entry.

Coverage processes dates chronologically, including same-day contributions before coverage. Future deposits cannot fund earlier shortfalls, and the same savings cannot be used twice. Each transfer appears in both the cash and savings timelines, without overwriting the entered opening balances. Unchecking a date recalculates later balances.

With no coverage selections, the savings comparison uses current savings and the largest cash deficit. With selections, it shows planned transfers, projected savings remaining, and unresolved shortfalls. Invalid savings details suspend coverage without hiding the main cash forecast; existing selections can still be unchecked.

On screens below 640px, coverage controls appear beneath each forecast row. On wider screens they appear in the balance cell. Only one placement is visible or keyboard-accessible at a time, and resizing preserves the selection.

## Current persistence

Plans load from the signed-in account's PostgreSQL tables. Valid changes save automatically after a 600 ms pause in editing. One save runs at a time; edits made during a request are queued for the next save. The status above the planner distinguishes saved changes, pending changes, active saving, validation errors, and failed requests. Incomplete fields remain in memory and do not replace the last valid database plan.

When the account has no database plan, the app checks its old per-account browser backup and imports that plan. The first account can still claim an older pre-login plan using an ownership marker. Older saved formats receive missing defaults, and browser backups are retained after import. Once a database plan exists it always takes priority; ordinary edits no longer write browser storage.

Database load failures show a retry screen instead of a blank editable plan. Save failures keep edits in memory and provide a retry button. An expired session can be renewed in a new tab before retrying. Closing/reloading with unsaved changes triggers the browser's warning; signing out also asks before discarding unsaved edits. Offline edits are not durably stored, so keep the tab open until saving succeeds.

If another device or tab saved a newer version, automatic saving stops and offers **Reload saved plan**. Reloading discards this tab's unsaved edits after the browser warning. Other devices pick up changes when opening or reloading the planner; changes are not pushed live between tabs.

Coverage selections belong to dates and recalculate when amounts or schedules change. Selections outside the current forecast remain saved for later windows. Clearing browser data does not remove the account's database plan.
