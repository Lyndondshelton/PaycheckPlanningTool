import test from "node:test";
import assert from "node:assert/strict";
import { addDays, createPlan, forecast, forecastDays, forecastEndDate, HORIZONS, MAX_FORECAST_DAYS, isDate, isMoney, isSavedPlan, paycheckAmount, planErrors, purchaseError, restorePlan } from "../lib/planner/planner.ts";

const plan = (overrides = {}) => ({ ...createPlan("2026-10-26"), income: "100", paySchedule: "weekly", ...overrides });
const bill = (overrides = {}) => ({ id: "bill", name: "Bill", amount: "25", dueDate: "2026-10-28", schedule: "monthly", ...overrides });
const purchase = (overrides = {}) => ({ id: "purchase", name: "Concert tickets", amount: "25.10", date: "2026-10-28", ...overrides });

test("purpose example: $100 Monday, two $25 bills, $50 left Friday; omit inactive days", () => {
  const rows = forecast(plan({ horizon: 14, bills: [bill(), bill({ id: "second", dueDate: "2026-10-30" })] }));
  assert.deepEqual(rows.map(({ date, balance }) => [date, balance]), [
    ["2026-10-26", 10000], ["2026-10-28", 7500], ["2026-10-30", 5000], ["2026-11-02", 15000],
  ]);
});
test("all requested horizons include the start and exclude the day after the window", () => {
  for (const horizon of HORIZONS) {
    const rows = forecast(plan({ horizon, nextPayday: addDays("2026-10-26", horizon - 1) }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, addDays("2026-10-26", horizon - 1));
    assert.deepEqual(forecast(plan({ horizon, nextPayday: addDays("2026-10-26", horizon) })), []);
  }
});
test("weekly and biweekly anchors continue from dates before the forecast", () => {
  assert.deepEqual(forecast(plan({ nextPayday: "2026-10-12", paySchedule: "biweekly", horizon: 30 })).map(row => row.date), ["2026-10-26", "2026-11-09", "2026-11-23"]);
});
test("annual, monthly, and weekly income convert to the selected pay schedule", () => {
  for (const [paySchedule, periods] of Object.entries({ weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 })) {
    assert.equal(paycheckAmount(plan({ income: "62400", incomeBasis: "yearly", paySchedule })), 6240000 / periods);
    assert.equal(paycheckAmount(plan({ income: "5200", incomeBasis: "monthly", paySchedule })), 6240000 / periods);
    assert.equal(paycheckAmount(plan({ income: "1200", incomeBasis: "weekly", paySchedule })), 6240000 / periods);
    assert.equal(paycheckAmount(plan({ income: "123.45", paySchedule })), 12345);
  }
});
test("monthly paydays clamp short months without drifting from the original day", () => {
  const rows = forecast(plan({ startDate: "2027-01-31", nextPayday: "2027-01-31", paySchedule: "monthly", horizon: 90 }));
  assert.deepEqual(rows.map(row => row.date), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
});
test("twice-monthly pay supports the 15th and month end across February", () => {
  const rows = forecast(plan({ startDate: "2027-01-31", nextPayday: "2027-01-31", paySchedule: "semimonthly", firstPayDay: 15, secondPayDay: 31, horizon: 60 }));
  assert.deepEqual(rows.map(row => row.date), ["2027-01-31", "2027-02-15", "2027-02-28", "2027-03-15", "2027-03-31"]);
});
test("two monthly pay days clamped onto one date preserve both deposits in one day", () => {
  const rows = forecast(plan({ startDate: "2027-02-01", nextPayday: "2027-02-28", paySchedule: "semimonthly", firstPayDay: 30, secondPayDay: 31, horizon: 28 }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].income, 20000);
  assert.equal(rows[0].transactions.length, 2);
});
test("weekly bills repeat every seven days from the due date, across DST and month end", () => {
  const rows = forecast(plan({ income: "0", startingBalance: "100", horizon: 30, bills: [bill({ schedule: "weekly" })] }));
  assert.deepEqual(rows.map(({ date, balance }) => [date, balance]), [
    ["2026-10-28", 7500], ["2026-11-04", 5000], ["2026-11-11", 2500], ["2026-11-18", 0],
  ]);
});
test("weekly bills continue from past anchors and recur across year end", () => {
  const rows = forecast(plan({ income: "0", startDate: "2026-12-28", horizon: 14,
    bills: [bill({ schedule: "weekly", dueDate: "2026-12-16" })] }));
  assert.deepEqual(rows.map(row => row.date), ["2026-12-30", "2027-01-06"]);
});
test("weekly bills do not occur before their next due date and survive storage validation", () => {
  const saved = plan({ income: "0", horizon: 14, bills: [bill({ schedule: "weekly", dueDate: "2026-11-09" })] });
  assert.equal(isSavedPlan(JSON.parse(JSON.stringify(saved))), true);
  assert.deepEqual(forecast(saved), []);
});
test("monthly bills recur from old anchors and preserve month-end days", () => {
  const rows = forecast(plan({ income: "0", startDate: "2027-02-01", horizon: 60, bills: [bill({ dueDate: "2020-01-31" })] }));
  assert.deepEqual(rows.map(row => row.date), ["2027-02-28", "2027-03-31"]);
});
test("semiannual bills recur across years and clamp to February month end", () => {
  const rows = forecast(plan({ income: "0", startDate: "2027-02-01", horizon: 90, bills: [bill({ dueDate: "2020-08-31", schedule: "semiannually" })] }));
  assert.deepEqual(rows.map(row => row.date), ["2027-02-28"]);
});
test("yearly leap-day bills return to February 29 in a leap year", () => {
  const bills = [bill({ dueDate: "2024-02-29", schedule: "yearly" })];
  assert.equal(forecast(plan({ income: "0", startDate: "2027-02-01", horizon: 30, bills }))[0].date, "2027-02-28");
  assert.equal(forecast(plan({ income: "0", startDate: "2028-02-01", horizon: 30, bills }))[0].date, "2028-02-29");
});
test("future bills are never charged before their first due date", () => {
  assert.deepEqual(forecast(plan({ income: "0", bills: [bill({ dueDate: "2027-10-28" })] })), []);
});
test("same-day income and multiple bills have one closing balance", () => {
  const rows = forecast(plan({ startingBalance: "10.05", bills: [bill({ dueDate: "2026-10-26", amount: "110.10" }), bill({ id: "other", dueDate: "2026-10-26", amount: "0.20" })] }));
  assert.equal(rows[0].transactions.length, 3);
  assert.equal(rows[0].balance, -25);
  assert.equal(rows[1].balance, 9975);
});
test("zero income permits a bill-only forecast and fractional cents are rejected", () => {
  const rows = forecast(plan({ income: "0", startingBalance: "0.30", bills: [bill({ amount: "0.10" })] }));
  assert.equal(rows[0].balance, 20);
  assert.deepEqual(forecast(plan({ income: "10.001" })), []);
  for (const value of ["", "-1", "NaN", "Infinity", "1e5", "1.001", "1000000001"]) assert.equal(isMoney(value), false);
  assert.equal(isMoney("-25.50", true), true);
});
test("date arithmetic uses calendar days across DST, leap day, and year end", () => {
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  for (const value of ["", "2027-02-29", "2026-02-30", "2026-13-01", "0001-01-01"]) assert.equal(isDate(value), false);
});
test("invalid dates, balances, bills, and twice-monthly settings block calculation", () => {
  assert.ok(planErrors(plan({ startingBalance: "" })).startingBalance);
  assert.ok(planErrors(plan({ startDate: "" })).startDate);
  assert.ok(planErrors(plan({ bills: [bill({ amount: "0" })] })).bills);
  assert.ok(planErrors(plan({ paySchedule: "semimonthly", firstPayDay: 15, secondPayDay: 15 })).payDays);
  assert.ok(planErrors(plan({ paySchedule: "semimonthly" })).nextPayday);
});
test("storage accepts a round trip and rejects corrupted, incompatible, or duplicate records", () => {
  assert.equal(isSavedPlan(JSON.parse(JSON.stringify(plan({ bills: [bill()] })))), true);
  for (const value of [null, {}, { ...plan(), horizon: 365 }, { ...plan(), incomeBasis: "constructor" }, { ...plan(), bills: [{}] }, { ...plan(), bills: [bill(), bill()] }]) assert.equal(isSavedPlan(value), false);
});

test("one-time purchases are deducted exactly once in a 90-day forecast", () => {
  const rows = forecast(plan({ income: "0", startingBalance: "100", horizon: 90, purchases: [purchase()] }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-10-28");
  assert.equal(rows[0].expenses, 2510);
  assert.equal(rows[0].balance, 7490);
  assert.equal(rows[0].transactions[0].kind, "purchase");
});
test("purchase boundaries respect every horizon and exclude past and future spending", () => {
  for (const horizon of HORIZONS) {
    const entries = [
      purchase({ id: "past", date: "2026-10-25" }),
      purchase({ id: "start", date: "2026-10-26" }),
      purchase({ id: "end", date: addDays("2026-10-26", horizon - 1) }),
      purchase({ id: "future", date: addDays("2026-10-26", horizon) }),
    ];
    const rows = forecast(plan({ income: "0", horizon, purchases: entries }));
    assert.deepEqual(rows.map(row => row.date), ["2026-10-26", addDays("2026-10-26", horizon - 1)]);
    assert.equal(rows[1].balance, -5020);
  }
});
test("same-day pay, bills, and multiple purchases share one accurate closing balance", () => {
  const rows = forecast(plan({ horizon: 14, bills: [bill({ id: "same-id", dueDate: "2026-10-26" })],
    purchases: [purchase({ id: "same-id", date: "2026-10-26" }), purchase({ id: "other", amount: "0.20", date: "2026-10-26" })] }));
  assert.equal(rows[0].transactions.length, 4);
  assert.equal(new Set(rows[0].transactions.map(item => item.id)).size, 4);
  assert.equal(rows[0].income, 10000);
  assert.equal(rows[0].expenses, 5030);
  assert.equal(rows[0].balance, 4970);
  assert.equal(rows[1].balance, 14970);
});
test("invalid purchase details block the forecast", () => {
  for (const entry of [purchase({ name: "  " }), purchase({ name: "x".repeat(81) }),
    purchase({ amount: "0" }), purchase({ amount: "-25" }), purchase({ amount: "0.001" }),
    purchase({ amount: "1000000001" }), purchase({ date: "2027-02-29" }), purchase({ date: "" })]) {
    assert.ok(purchaseError(entry));
    assert.ok(planErrors(plan({ purchases: [entry] })).purchases);
    assert.deepEqual(forecast(plan({ purchases: [entry] })), []);
  }
  assert.equal(purchaseError(purchase()), undefined);
});
test("purchase storage round trips and rejects malformed or duplicate records", () => {
  const saved = plan({ purchases: [purchase()] });
  assert.equal(isSavedPlan(JSON.parse(JSON.stringify(saved))), true);
  assert.deepEqual(restorePlan(JSON.parse(JSON.stringify(saved))), saved);
  for (const purchases of [null, {}, [null], [{}], [purchase({ amount: 25 })], [purchase(), purchase()]]) {
    assert.equal(isSavedPlan({ ...saved, purchases }), false);
    assert.equal(restorePlan({ ...saved, purchases }), null);
  }
});
test("legacy saved plans gain an empty purchases list without changing their bills or income", () => {
  const legacy = { ...plan({ bills: [bill({ schedule: "weekly" })] }) };
  delete legacy.purchases;
  assert.equal(isSavedPlan(legacy), false);
  assert.deepEqual(restorePlan(legacy), { ...legacy, purchases: [] });
  assert.equal(Object.hasOwn(legacy, "purchases"), false);
  assert.equal(restorePlan(null), null);
  assert.equal(restorePlan({}), null);
});

test("a custom target includes transactions on the target date and omits the following day", () => {
  const custom = plan({ horizon: "custom", targetDate: "2026-11-02", bills: [bill()], purchases: [
    purchase({ id: "last", amount: "10", date: "2026-11-02" }),
    purchase({ id: "after", amount: "50", date: "2026-11-03" }),
  ] });
  assert.equal(forecastDays(custom), 8);
  assert.equal(forecastEndDate(custom), "2026-11-02");
  assert.deepEqual(forecast(custom).map(({ date, balance }) => [date, balance]), [
    ["2026-10-26", 10000], ["2026-10-28", 7500], ["2026-11-02", 16500],
  ]);
});
test("a one-day custom forecast groups same-day income, bills, and purchases", () => {
  const custom = plan({ horizon: "custom", targetDate: "2026-10-26", bills: [bill({ dueDate: "2026-10-26" })],
    purchases: [purchase({ date: "2026-10-26" })] });
  assert.equal(forecastDays(custom), 1);
  assert.equal(forecastEndDate(custom), custom.startDate);
  const rows = forecast(custom);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].balance, 4990);
  assert.equal(rows[0].transactions.length, 3);
});
test("custom targets extend beyond 90 days and count leap days and DST as calendar days", () => {
  for (const [startDate, targetDate, days] of [
    ["2026-10-26", "2027-02-01", 99], ["2028-02-28", "2028-03-01", 3], ["2026-10-31", "2026-11-02", 3],
  ]) {
    const custom = plan({ startDate, nextPayday: startDate, horizon: "custom", targetDate });
    assert.equal(forecastDays(custom), days);
    assert.equal(forecastEndDate(custom), targetDate);
    assert.ok(forecast(custom).length > 0);
  }
});
test("custom ranges reject empty, invalid, reversed, and excessive dates", () => {
  for (const targetDate of ["", "2026-02-30", "2026-10-25", addDays("2026-10-26", MAX_FORECAST_DAYS)]) {
    const custom = plan({ horizon: "custom", targetDate });
    assert.ok(planErrors(custom).targetDate);
    assert.deepEqual(forecast(custom), []);
  }
  const maximum = plan({ horizon: "custom", targetDate: addDays("2026-10-26", MAX_FORECAST_DAYS - 1) });
  assert.deepEqual(planErrors(maximum), {});
  assert.equal(forecastDays(maximum), MAX_FORECAST_DAYS);
});
test("preset forecasts retain their range regardless of a previously entered custom date", () => {
  for (const horizon of HORIZONS) {
    const preset = plan({ horizon, targetDate: "2020-01-01" });
    assert.deepEqual(planErrors(preset), {});
    assert.equal(forecastDays(preset), horizon);
    assert.equal(forecastEndDate(preset), addDays(preset.startDate, horizon - 1));
  }
});
test("custom dates round trip through storage and earlier schemas receive only missing defaults", () => {
  const custom = plan({ horizon: "custom", targetDate: "2027-02-01", bills: [bill()], purchases: [purchase()] });
  assert.equal(isSavedPlan(custom), true);
  assert.deepEqual(restorePlan(JSON.parse(JSON.stringify(custom))), custom);
  assert.equal(isSavedPlan({ ...custom, targetDate: null }), false);
  assert.equal(restorePlan({ ...custom, horizon: "unknown" }), null);
  const legacy = { ...plan({ bills: [bill()], purchases: [purchase()] }) };
  delete legacy.targetDate;
  assert.deepEqual(restorePlan(legacy), { ...legacy, targetDate: "" });
  delete legacy.purchases;
  assert.deepEqual(restorePlan(legacy), { ...legacy, targetDate: "", purchases: [] });
});
