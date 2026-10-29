import test from "node:test";
import assert from "node:assert/strict";
import { createPlan, createSavingsPlan, forecast, forecastSavings, isSavedPlan, restorePlan,
  savingsContributionError, savingsCoverage, savingsProjectionErrors } from "../lib/planner/planner.ts";

const contribution = (overrides = {}) => ({ id: "saving", name: "Emergency fund", amount: "25.10", date: "2026-10-28", schedule: "weekly", ...overrides });
const plan = (overrides = {}) => ({ ...createPlan("2026-10-26"), income: "100", paySchedule: "weekly", ...overrides });
const savings = (overrides = {}) => ({ ...createSavingsPlan(), balance: "100", contributions: [contribution()], ...overrides });

test("planned savings and current savings never alter the main cash forecast", () => {
  const base = plan();
  const withSavings = { ...base, savings: savings({ balance: "5000", goal: "10000" }) };
  assert.deepEqual(forecast(withSavings), forecast(base));
  assert.ok(forecastSavings(withSavings).length > 0);
  assert.deepEqual(forecast({ ...base, savings: savings({ balance: "invalid", goal: "-1" }) }), forecast(base));
});
test("one-time, weekly, and biweekly savings schedules recur on calendar dates", () => {
  for (const [schedule, expected] of [
    ["once", ["2026-10-28"]],
    ["weekly", ["2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18"]],
    ["biweekly", ["2026-10-28", "2026-11-11"]],
  ]) {
    const rows = forecastSavings(plan({ savings: savings({ contributions: [contribution({ schedule })] }) }));
    assert.deepEqual(rows.map(row => row.date), expected);
    assert.equal(rows.at(-1).balance, 10000 + expected.length * 2510);
  }
});
test("monthly savings clamp short months without drifting from the original date", () => {
  const rows = forecastSavings(plan({ startDate: "2027-01-31", horizon: 90, savings: savings({ contributions: [contribution({ date: "2027-01-31", schedule: "monthly" })] }) }));
  assert.deepEqual(rows.map(row => row.date), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
});
test("every-payday contributions begin on the first payday at or after their start date", () => {
  const rows = forecastSavings(plan({ paySchedule: "biweekly", savings: savings({ contributions: [contribution({ schedule: "payday" })] }) }));
  assert.deepEqual(rows.map(row => row.date), ["2026-11-09", "2026-11-23"]);
});
test("coincident twice-monthly paydays produce two savings contributions", () => {
  const rows = forecastSavings(plan({ startDate: "2027-02-01", nextPayday: "2027-02-28", horizon: 28,
    paySchedule: "semimonthly", firstPayDay: 30, secondPayDay: 31,
    savings: savings({ contributions: [contribution({ date: "2027-02-01", schedule: "payday" })] }) }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contributions.length, 2);
  assert.equal(rows[0].amount, 5020);
});
test("savings forecast groups same-day contributions and retains cent precision", () => {
  const rows = forecastSavings(plan({ savings: savings({ balance: "0.30", contributions: [
    contribution({ amount: "0.10", schedule: "once" }), contribution({ id: "other", amount: "0.20", schedule: "once" }),
  ] }) }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 30);
  assert.equal(rows[0].balance, 60);
});
test("savings include custom target dates, exclude past deposits, and retain old schedule anchors", () => {
  const rows = forecastSavings(plan({ horizon: "custom", targetDate: "2026-11-02", savings: savings({ contributions: [
    contribution({ date: "2026-10-19" }),
    contribution({ id: "past", date: "2026-10-25", schedule: "once" }),
    contribution({ id: "future", date: "2026-11-03", schedule: "once" }),
  ] }) }));
  assert.deepEqual(rows.map(row => row.date), ["2026-10-26", "2026-11-02"]);
  assert.equal(rows[1].balance, 15020);
});
test("savings forecast works without income and never overwrites current savings or caps deposits at the goal", () => {
  const input = plan({ income: "", savings: savings({ goal: "110" }) });
  const original = JSON.stringify(input);
  const rows = forecastSavings(input);
  assert.equal(rows.at(-1).balance, 20040);
  assert.equal(JSON.stringify(input), original);
});
test("invalid savings, contribution details, or ranges suspend only savings projections", () => {
  for (const item of [contribution({ name: " " }), contribution({ amount: "0" }), contribution({ amount: "-1" }),
    contribution({ amount: "0.001" }), contribution({ date: "2027-02-29" }), contribution({ schedule: "unknown" })]) {
    assert.ok(savingsContributionError(item));
    assert.deepEqual(forecastSavings(plan({ savings: savings({ contributions: [item] }) })), []);
  }
  for (const setting of [savings({ balance: "-1" }), savings({ goal: "0" }), savings({ goal: "0.001" })]) {
    assert.ok(Object.keys(savingsProjectionErrors(plan({ savings: setting }))).length > 0);
  }
  assert.deepEqual(forecastSavings(plan({ horizon: "custom", targetDate: "2026-10-25", savings: savings() })), []);
  assert.deepEqual(forecastSavings(plan({ nextPayday: "", savings: savings({ contributions: [contribution({ schedule: "payday" })] }) })), []);
});
test("shortfall coverage distinguishes no deficit, full coverage, exact coverage, and uncovered amounts", () => {
  assert.deepEqual(savingsCoverage("100", 1000), { available: 10000, shortfall: 0, covered: true, remaining: 10000, uncovered: 0 });
  assert.deepEqual(savingsCoverage("100", -7500), { available: 10000, shortfall: 7500, covered: true, remaining: 2500, uncovered: 0 });
  assert.deepEqual(savingsCoverage("75", -7500), { available: 7500, shortfall: 7500, covered: true, remaining: 0, uncovered: 0 });
  assert.deepEqual(savingsCoverage("25", -7500), { available: 2500, shortfall: 7500, covered: false, remaining: 0, uncovered: 5000 });
  assert.equal(savingsCoverage("", -5000), null);
});
test("coverage uses the largest cash deficit and current savings, never projected deposits", () => {
  const input = plan({ income: "0", startingBalance: "-50", bills: [{ id: "rent", name: "Rent", amount: "50", dueDate: "2026-10-28", schedule: "monthly" }],
    savings: savings({ balance: "25", contributions: [contribution({ amount: "1000", schedule: "once" })] }) });
  const cashRows = forecast(input);
  const lowest = Math.min(-5000, ...cashRows.map(row => row.balance));
  assert.equal(forecastSavings(input).at(-1).balance, 102500);
  assert.equal(savingsCoverage(input.savings.balance, lowest).uncovered, 7500);
});
test("savings storage round trips, rejects corrupted settings, and migrates old plans without losing entries", () => {
  const input = plan({ savings: savings() });
  assert.equal(isSavedPlan(input), true);
  assert.deepEqual(restorePlan(JSON.parse(JSON.stringify(input))), input);
  const legacy = { ...input }; delete legacy.savings;
  assert.deepEqual(restorePlan(legacy), { ...legacy, savings: createSavingsPlan() });
  for (const setting of [null, {}, { ...savings(), contributions: [{}] }, { ...savings(), contributions: [contribution(), contribution()] }]) {
    assert.equal(restorePlan({ ...input, savings: setting }), null);
  }
});
