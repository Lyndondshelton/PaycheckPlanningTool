// Exercise schema rules and transaction boundaries without connecting to a real database.
import test from "node:test";
import assert from "node:assert/strict";
import { createPlan } from "../lib/planner/planner.ts";
import { normalizePlan, planSaveError } from "../lib/planner/persistence.ts";
import { dollars, storedId, PlanConflictError, PlanRepository } from "../lib/db/plan-repository.ts";

const userId = "account-a";
function validPlan() {
  return { ...createPlan("2026-10-28"), income: "1234.56", startingBalance: "-20.01",
    bills: [{ id: "example-rent", name: "Rent", amount: "800", dueDate: "2026-11-01", schedule: "monthly" }],
    purchases: [{ id: "purchase", name: "Tickets", amount: "12.99", date: "2026-11-02" }],
    savings: { balance: "250", goal: "", contributions: [{ id: "deposit", name: "Deposit", amount: "25", date: "2026-11-03", schedule: "payday" }] },
    savingsCoverDates: ["2026-11-02"] };
}

// Supply database-shaped rows, recording statements instead of emulating PostgreSQL itself.
function database(rows = {}, failOn = () => false) {
  const calls = [];
  let released = false, releaseError, connections = 0;
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (failOn(sql)) throw new Error("Simulated database failure");
      if (sql.includes('FROM "user"')) return { rows: [{ id: userId }] };
      const table = /FROM (\w+)/.exec(sql)?.[1];
      return { rows: sql.trim().startsWith("SELECT") ? rows[table] ?? [] : [] };
    },
    release(error) { released = true; releaseError = error; },
  };
  return { pool: { async connect() { connections++; return client; } }, calls,
    get released() { return released; }, get releaseError() { return releaseError; }, get connections() { return connections; } };
}

function savedRows() {
  return {
    income_settings: [{ amount_cents: "123456", amount_is: "paycheck", pay_schedule: "biweekly", first_pay_day: 1, second_pay_day: 15, next_payday: "2026-10-28" }],
    planner_settings: [{ starting_balance_cents: "-2001", forecast_start_date: "2026-10-28", selected_range: "30", custom_target_date: null }],
    savings: [{ current_savings_cents: "25000", savings_goal_cents: null }],
    recurring_bills: [{ bill_id: storedId(userId, "example-rent"), bill_name: "Rent", amount_cents: "80000", bill_repeats: "monthly", next_due_date: "2026-11-01" }],
    one_time_purchases: [{ purchase_id: storedId(userId, "purchase"), purchase_name: "Tickets", amount_cents: "1299", purchase_date: "2026-11-02" }],
    savings_contributions: [{ savings_contr_id: storedId(userId, "deposit"), savings_contr_name: "Deposit", amount_cents: "2500", savings_schedule: "payday", savings_contr_date: "2026-11-03" }],
    savings_coverage_selections: [{ coverage_date: "2026-11-02" }],
  };
}

test("case-sensitive uniqueness matches the applied schema after trimming names", () => {
  const plan = validPlan();
  plan.bills.push({ ...plan.bills[0], id: "second", name: " Rent " });
  assert.match(planSaveError(plan), /different name/);
  plan.bills[1].name = "rent";
  assert.equal(planSaveError(plan), undefined);
  plan.purchases.push({ ...plan.purchases[0], id: "second" });
  assert.match(planSaveError(plan), /same date/);
  plan.purchases[1].date = "2026-11-03";
  assert.equal(planSaveError(plan), undefined);
  plan.savings.contributions.push({ ...plan.savings.contributions[0], id: "second" });
  assert.match(planSaveError(plan), /contribution/);
});

test("incomplete money, invalid ranges, IDs, and goals cannot be saved", () => {
  for (const change of [p => { p.income = ""; }, p => { p.income = "1.001"; },
    p => { p.savings.goal = "0"; }, p => { p.horizon = "custom"; p.targetDate = "2026-10-27"; },
    p => { p.paySchedule = "semimonthly"; p.secondPayDay = p.firstPayDay; },
    p => { p.bills[0].id = ""; }, p => { p.bills[0].name = "bad\0name"; }]) {
    const plan = validPlan(); change(plan);
    assert.ok(planSaveError(plan));
  }
  assert.ok(planSaveError({}));
});

test("normalization is stable without mutating input or changing negative cents", () => {
  const plan = validPlan(); plan.bills[0].name = " Rent ";
  const normalized = normalizePlan(plan);
  assert.equal(normalized.bills[0].name, "Rent");
  assert.equal(plan.bills[0].name, " Rent ");
  assert.equal(normalized.startingBalance, "-20.01");
  assert.equal(normalized.savings.goal, "");
  assert.deepEqual(normalizePlan(normalized), normalized);
  assert.equal(dollars("-1"), "-0.01");
  assert.throws(() => dollars("9007199254740993"));
  assert.throws(() => dollars("1.5"));
});

test("row IDs distinguish accounts even when their example IDs are identical", () => {
  assert.notEqual(storedId("a", "example-rent"), storedId("b", "example-rent"));
  assert.notEqual(storedId("a:b", "c"), storedId("a", "b:c"));
});

test("empty accounts load with a consistent read transaction and a released client", async () => {
  const db = database();
  assert.deepEqual(await new PlanRepository(db.pool).load(userId), { plan: null, version: null });
  assert.equal(db.calls[0].sql, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(db.calls.at(-1).sql, "COMMIT");
  assert.equal(db.calls.filter(call => call.sql.trim().startsWith("SELECT")).length, 7);
  for (const call of db.calls.filter(call => call.values)) assert.deepEqual(call.values, [userId]);
  assert.ok(db.released);
});

test("all table mappings restore dates, ranges, cents, optional goals, and client IDs", async () => {
  const db = database(savedRows());
  const result = await new PlanRepository(db.pool).load(userId);
  assert.deepEqual(result.plan, normalizePlan(validPlan()));
  assert.match(result.version, /^[a-f0-9]{64}$/);
  const second = await new PlanRepository(database(savedRows()).pool).save(userId, validPlan(), result.version);
  assert.equal(second.version, result.version);
  const rows = savedRows(); rows.planner_settings[0].selected_range = "custom";
  rows.planner_settings[0].custom_target_date = "2026-11-30";
  rows.savings[0].savings_goal_cents = "100000";
  const custom = await new PlanRepository(database(rows).pool).load(userId);
  assert.equal(custom.plan.horizon, "custom");
  assert.equal(custom.plan.targetDate, "2026-11-30");
  assert.equal(custom.plan.savings.goal, "1000.00");
});

test("partial existing data fails rather than importing over it", async () => {
  const db = database({ recurring_bills: savedRows().recurring_bills });
  await assert.rejects(new PlanRepository(db.pool).load(userId), /incomplete/);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.ok(db.released);
});

test("first save locks the user, writes every collection with bound owner IDs, and commits", async () => {
  const db = database();
  const result = await new PlanRepository(db.pool).save(userId, validPlan(), null);
  assert.match(db.calls[1].sql, /FROM "user" WHERE id = \$1 FOR UPDATE/);
  const writes = db.calls.filter(call => call.sql.trim().startsWith("INSERT"));
  assert.equal(writes.length, 7);
  for (const call of writes) assert.equal(call.values[0], userId);
  for (const call of db.calls.filter(call => call.sql.startsWith("DELETE"))) {
    assert.match(call.sql, /WHERE user_id = \$1$/);
    assert.deepEqual(call.values, [userId]);
  }
  assert.equal(writes[0].values[1], 123456);
  assert.equal(writes[1].values[1], -2001);
  assert.equal(writes[2].values[2], null);
  assert.equal(writes[3].values[1], storedId(userId, "example-rent"));
  assert.equal(db.calls.at(-1).sql, "COMMIT");
  assert.match(result.version, /^[a-f0-9]{64}$/);
  assert.ok(db.released);
});

test("a stale device cannot overwrite a newer plan, including simultaneous first saves", async () => {
  const db = database(savedRows());
  await assert.rejects(new PlanRepository(db.pool).save(userId, validPlan(), null), PlanConflictError);
  assert.ok(!db.calls.some(call => /^(INSERT|DELETE)/.test(call.sql.trim())));
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  const loaded = await new PlanRepository(database(savedRows()).pool).load(userId);
  const changed = savedRows(); changed.income_settings[0].amount_cents = "200000";
  await assert.rejects(new PlanRepository(database(changed).pool).save(userId, validPlan(), loaded.version), PlanConflictError);
});

test("a failure partway through saving rolls back all tables and releases the client", async () => {
  const db = database({}, sql => sql.includes("INSERT INTO one_time_purchases"));
  await assert.rejects(new PlanRepository(db.pool).save(userId, validPlan(), null), /Simulated/);
  assert.ok(db.calls.some(call => call.sql.includes("INSERT INTO recurring_bills")));
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.ok(!db.calls.some(call => call.sql === "COMMIT"));
  assert.ok(db.released);
});

test("a connection that cannot roll back is removed from the pool", async () => {
  const db = database({}, sql => sql.includes("INSERT INTO savings") || sql === "ROLLBACK");
  await assert.rejects(new PlanRepository(db.pool).save(userId, validPlan(), null), /Simulated/);
  assert.ok(db.releaseError instanceof Error);
});

test("invalid plans fail validation before opening a database connection", async () => {
  const db = database();
  await assert.rejects(new PlanRepository(db.pool).save(userId, createPlan("2026-10-28"), null));
  assert.equal(db.connections, 0);
});
