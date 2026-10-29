import test from "node:test";
import assert from "node:assert/strict";
import { createPlan, createSavingsPlan, forecastPlan, isSavedPlan, restorePlan } from "../lib/planner/planner.ts";

const start = "2026-10-26";
const bill = (overrides = {}) => ({ id: "bill", name: "Bill", amount: "100", dueDate: "2026-10-28", schedule: "monthly", ...overrides });
const deposit = (overrides = {}) => ({ id: "deposit", name: "Savings deposit", amount: "100", date: "2026-10-28", schedule: "once", ...overrides });
const plan = (overrides = {}) => ({ ...createPlan(start), income: "0", horizon: 14, bills: [bill()],
  savings: { ...createSavingsPlan(), balance: "100" }, ...overrides });

test("selected coverage fully covers a deficit and records equal transfers in both ledgers", () => {
  const input = plan({ savingsCoverDates: ["2026-10-28"] });
  const result = forecastPlan(input);
  assert.equal(result.cash[0].balance, 0);
  assert.equal(result.cash[0].income, 0);
  assert.equal(result.cash[0].expenses, 10000);
  assert.equal(result.cash[0].transactions.at(-1).kind, "savings");
  assert.equal(result.cash[0].transactions.at(-1).amount, 10000);
  assert.equal(result.savings[0].withdrawal, 10000);
  assert.equal(result.savings[0].balance, 0);
  assert.deepEqual(result.coverage["2026-10-28"], { beforeCoverage: -10000, available: 10000, transferred: 10000, remainingShortfall: 0 });
  assert.equal(input.startingBalance, "0");
  assert.equal(input.savings.balance, "100");
});
test("partial savings coverage uses all available funds and leaves the shortfall visible", () => {
  const result = forecastPlan(plan({ savings: { ...createSavingsPlan(), balance: "40" }, savingsCoverDates: ["2026-10-28"] }));
  assert.equal(result.cash[0].balance, -6000);
  assert.equal(result.savings[0].balance, 0);
  assert.equal(result.coverage["2026-10-28"].transferred, 4000);
  assert.equal(result.coverage["2026-10-28"].remainingShortfall, 6000);
});
test("same-day planned deposits are available before coverage is applied", () => {
  const result = forecastPlan(plan({ savings: { balance: "40", goal: "", contributions: [deposit({ amount: "60" })] }, savingsCoverDates: ["2026-10-28"] }));
  assert.equal(result.coverage["2026-10-28"].available, 10000);
  assert.equal(result.cash[0].balance, 0);
  assert.equal(result.savings[0].amount, 6000);
  assert.equal(result.savings[0].withdrawal, 10000);
  assert.equal(result.savings[0].balance, 0);
});
test("future savings are never borrowed to cover an earlier deficit", () => {
  const result = forecastPlan(plan({ savings: { balance: "0", goal: "", contributions: [deposit({ date: "2026-10-30", amount: "150" })] },
    savingsCoverDates: ["2026-10-28", "2026-10-30"] }));
  assert.equal(result.coverage["2026-10-28"].available, 0);
  assert.equal(result.coverage["2026-10-28"].remainingShortfall, 10000);
  assert.equal(result.coverage["2026-10-30"].transferred, 10000);
  assert.deepEqual(result.cash.map(row => row.balance), [-10000, 0]);
  assert.equal(result.savings.at(-1).balance, 5000);
});
test("multiple coverage days consume savings once and incorporate intervening deposits", () => {
  const input = plan({ bills: [bill({ amount: "80", dueDate: "2026-10-27" }), bill({ id: "second", amount: "50", dueDate: "2026-10-29" })],
    savings: { balance: "100", goal: "", contributions: [deposit({ amount: "50", date: "2026-10-29" })] },
    savingsCoverDates: ["2026-10-29", "2026-10-27"] });
  const original = JSON.stringify(input);
  const result = forecastPlan(input);
  assert.deepEqual(result.cash.map(row => row.balance), [0, 0]);
  assert.deepEqual(result.savings.map(row => row.balance), [2000, 2000]);
  assert.deepEqual(result.savings.map(row => row.withdrawal), [8000, 5000]);
  assert.equal(JSON.stringify(input), original);
});
test("savings cannot be spent twice on consecutive deficits", () => {
  const result = forecastPlan(plan({ bills: [bill({ amount: "80", dueDate: "2026-10-27" }), bill({ id: "second", amount: "50", dueDate: "2026-10-29" })],
    savingsCoverDates: ["2026-10-27", "2026-10-29"] }));
  assert.deepEqual(result.cash.map(row => row.balance), [0, -3000]);
  assert.equal(result.coverage["2026-10-29"].available, 2000);
  assert.equal(result.savings.at(-1).balance, 0);
});
test("unchecking coverage restores both ledgers and recomputes later transfers", () => {
  const input = plan({ bills: [bill({ amount: "30", dueDate: "2026-10-27" }), bill({ id: "second", amount: "40", dueDate: "2026-10-29" })] });
  const covered = forecastPlan({ ...input, savingsCoverDates: ["2026-10-27", "2026-10-29"] });
  const laterOnly = forecastPlan({ ...input, savingsCoverDates: ["2026-10-29"] });
  assert.equal(covered.coverage["2026-10-29"].transferred, 4000);
  assert.equal(laterOnly.coverage["2026-10-29"].transferred, 7000);
  assert.equal(laterOnly.cash[0].balance, -3000);
  assert.equal(covered.savings.at(-1).balance, laterOnly.savings.at(-1).balance);
  const unchecked = forecastPlan({ ...input, savingsCoverDates: [] });
  assert.deepEqual(unchecked, forecastPlan(input));
  assert.deepEqual(unchecked.cash.map(row => row.balance), [-3000, -7000]);
});
test("edits recalculate coverage amounts and retain a removable choice when coverage is unnecessary", () => {
  const selected = plan({ savingsCoverDates: ["2026-10-28"] });
  assert.equal(forecastPlan({ ...selected, bills: [bill({ amount: "25" })] }).coverage["2026-10-28"].transferred, 2500);
  const noDeficit = forecastPlan({ ...selected, startingBalance: "200" });
  assert.equal(noDeficit.cash[0].balance, 10000);
  assert.equal(noDeficit.coverage["2026-10-28"].transferred, 0);
  assert.deepEqual(noDeficit.savings, []);
});
test("coverage choices outside the selected range are retained but not applied", () => {
  const result = forecastPlan(plan({ horizon: "custom", targetDate: "2026-10-28", savingsCoverDates: ["2026-10-25", "2026-10-29"] }));
  assert.equal(result.cash[0].balance, -10000);
  assert.equal(result.savings.length, 0);
  assert.equal(result.coverage["2026-10-25"], undefined);
  assert.equal(result.coverage["2026-10-29"], undefined);
});
test("invalid savings leave cash forecasts visible but do not permit projected withdrawals", () => {
  const result = forecastPlan(plan({ savings: { ...createSavingsPlan(), balance: "invalid" }, savingsCoverDates: ["2026-10-28"] }));
  assert.equal(result.cash[0].balance, -10000);
  assert.equal(result.coverage["2026-10-28"].available, null);
  assert.deepEqual(result.savings, []);
});
test("coverage can resolve an opening deficit even without other cash transactions", () => {
  const result = forecastPlan(plan({ startingBalance: "-50", bills: [], savingsCoverDates: [start] }));
  assert.equal(result.cash[0].date, start);
  assert.equal(result.cash[0].balance, 0);
  assert.equal(result.savings[0].withdrawal, 5000);
  assert.equal(result.savings[0].balance, 5000);
});
test("coverage conserves money and handles fractional currency precisely", () => {
  const result = forecastPlan(plan({ bills: [bill({ amount: "0.30" })], savings: { balance: "0.10", goal: "", contributions: [deposit({ amount: "0.20" })] }, savingsCoverDates: ["2026-10-28"] }));
  assert.equal(result.coverage["2026-10-28"].transferred, 30);
  assert.equal(result.cash.at(-1).balance + result.savings.at(-1).balance, 0);
});
test("coverage choices persist and older plans receive an empty selection without data loss", () => {
  const input = plan({ savingsCoverDates: ["2026-10-28"] });
  assert.deepEqual(restorePlan(JSON.parse(JSON.stringify(input))), input);
  const legacy = { ...input }; delete legacy.savingsCoverDates;
  assert.deepEqual(restorePlan(legacy), { ...legacy, savingsCoverDates: [] });
  for (const dates of [null, {}, [1], ["2026-02-30"], ["2026-10-28", "2026-10-28"]]) {
    assert.equal(isSavedPlan({ ...input, savingsCoverDates: dates }), false);
  }
});
