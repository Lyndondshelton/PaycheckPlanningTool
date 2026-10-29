// SQL stays here; this module receives a pool so transaction behavior can be tested without Neon.
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { cents, type Plan } from "../planner/planner.ts";
import { normalizePlan, type PlanSnapshot } from "../planner/persistence.ts";

export class PlanConflictError extends Error {
  constructor() { super("Your plan changed on another device or tab. Reload the saved plan before editing again."); }
}

type IncomeRow = {
  amount_cents: string; amount_is: Plan["incomeBasis"]; pay_schedule: Plan["paySchedule"];
  first_pay_day: number | null; second_pay_day: number | null; next_payday: string;
};
type SettingsRow = { starting_balance_cents: string; forecast_start_date: string; selected_range: string; custom_target_date: string | null };
type SavingsRow = { current_savings_cents: string; savings_goal_cents: string | null };
type BillRow = { bill_id: string; bill_name: string; amount_cents: string; bill_repeats: Plan["bills"][number]["schedule"]; next_due_date: string };
type PurchaseRow = { purchase_id: string; purchase_name: string; amount_cents: string; purchase_date: string };
type ContributionRow = { savings_contr_id: string; savings_contr_name: string; amount_cents: string; savings_schedule: Plan["savings"]["contributions"][number]["schedule"]; savings_contr_date: string };

/** pg returns BIGINT as text. Reject unsafe values rather than rounding stored money. */
export function dollars(value: string): string {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100_000_000_000) throw new Error("Stored amount is outside the supported range.");
  return (amount / 100).toFixed(2);
}

// Existing TEXT primary keys are global. Prefixing makes example/import IDs distinct per account.
export function storedId(userId: string, id: string): string { return `${userId.length}:${userId}:${id}`; }
function plannerId(userId: string, id: string): string {
  const prefix = storedId(userId, "");
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}
function snapshot(plan: Plan): PlanSnapshot {
  const normalized = normalizePlan(plan);
  return { plan: normalized, version: createHash("sha256").update(JSON.stringify(normalized)).digest("hex") };
}

/** All reads share a client and snapshot so a concurrent save cannot produce a partial plan. */
async function readPlan(client: PoolClient, userId: string): Promise<PlanSnapshot> {
  const income = (await client.query<IncomeRow>(`
    SELECT amount_cents, amount_is, pay_schedule, first_pay_day, second_pay_day,
      to_char(next_payday, 'YYYY-MM-DD') AS next_payday
    FROM income_settings WHERE user_id = $1`, [userId])).rows;
  const settings = (await client.query<SettingsRow>(`
    SELECT starting_balance_cents, selected_range,
      to_char(forecast_start_date, 'YYYY-MM-DD') AS forecast_start_date,
      to_char(custom_target_date, 'YYYY-MM-DD') AS custom_target_date
    FROM planner_settings WHERE user_id = $1`, [userId])).rows;
  const savings = (await client.query<SavingsRow>(`
    SELECT current_savings_cents, savings_goal_cents FROM savings WHERE user_id = $1`, [userId])).rows;
  const bills = (await client.query<BillRow>(`
    SELECT bill_id, bill_name, amount_cents, bill_repeats,
      to_char(next_due_date, 'YYYY-MM-DD') AS next_due_date
    FROM recurring_bills WHERE user_id = $1`, [userId])).rows;
  const purchases = (await client.query<PurchaseRow>(`
    SELECT purchase_id, purchase_name, amount_cents,
      to_char(purchase_date, 'YYYY-MM-DD') AS purchase_date
    FROM one_time_purchases WHERE user_id = $1`, [userId])).rows;
  const contributions = (await client.query<ContributionRow>(`
    SELECT savings_contr_id, savings_contr_name, amount_cents, savings_schedule,
      to_char(savings_contr_date, 'YYYY-MM-DD') AS savings_contr_date
    FROM savings_contributions WHERE user_id = $1`, [userId])).rows;
  const coverage = (await client.query<{ coverage_date: string }>(`
    SELECT to_char(coverage_date, 'YYYY-MM-DD') AS coverage_date
    FROM savings_coverage_selections WHERE user_id = $1`, [userId])).rows;

  if ([income, settings, savings, bills, purchases, contributions, coverage].every(rows => rows.length === 0)) {
    return { plan: null, version: null };
  }
  // Incomplete existing data must never be mistaken for an empty account and overwritten by import.
  if (income.length !== 1 || settings.length !== 1 || savings.length !== 1) throw new Error("Stored plan is incomplete.");
  const pay = income[0], options = settings[0], saved = savings[0];
  return snapshot({
    income: dollars(pay.amount_cents), incomeBasis: pay.amount_is, paySchedule: pay.pay_schedule,
    nextPayday: pay.next_payday, firstPayDay: pay.first_pay_day ?? 1, secondPayDay: pay.second_pay_day ?? 15,
    startingBalance: dollars(options.starting_balance_cents), startDate: options.forecast_start_date,
    horizon: (options.selected_range === "custom" ? "custom" : Number(options.selected_range)) as Plan["horizon"],
    targetDate: options.custom_target_date ?? "",
    bills: bills.map(row => ({ id: plannerId(userId, row.bill_id), name: row.bill_name, amount: dollars(row.amount_cents), dueDate: row.next_due_date, schedule: row.bill_repeats })),
    purchases: purchases.map(row => ({ id: plannerId(userId, row.purchase_id), name: row.purchase_name, amount: dollars(row.amount_cents), date: row.purchase_date })),
    savings: { balance: dollars(saved.current_savings_cents), goal: saved.savings_goal_cents === null ? "" : dollars(saved.savings_goal_cents),
      contributions: contributions.map(row => ({ id: plannerId(userId, row.savings_contr_id), name: row.savings_contr_name, amount: dollars(row.amount_cents), date: row.savings_contr_date, schedule: row.savings_schedule })) },
    savingsCoverDates: coverage.map(row => row.coverage_date),
  });
}

/** Save a complete plan atomically; every statement is scoped to the authenticated user. */
async function writePlan(client: PoolClient, userId: string, plan: Plan) {
  await client.query(`INSERT INTO income_settings
    (user_id, amount_cents, amount_is, pay_schedule, first_pay_day, second_pay_day, next_payday)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO UPDATE SET
    amount_cents=EXCLUDED.amount_cents, amount_is=EXCLUDED.amount_is, pay_schedule=EXCLUDED.pay_schedule,
    first_pay_day=EXCLUDED.first_pay_day, second_pay_day=EXCLUDED.second_pay_day, next_payday=EXCLUDED.next_payday`,
  [userId, cents(plan.income), plan.incomeBasis, plan.paySchedule, plan.firstPayDay, plan.secondPayDay, plan.nextPayday]);
  await client.query(`INSERT INTO planner_settings
    (user_id, starting_balance_cents, forecast_start_date, selected_range, custom_target_date)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO UPDATE SET
    starting_balance_cents=EXCLUDED.starting_balance_cents, forecast_start_date=EXCLUDED.forecast_start_date,
    selected_range=EXCLUDED.selected_range, custom_target_date=EXCLUDED.custom_target_date`,
  [userId, cents(plan.startingBalance), plan.startDate, String(plan.horizon), plan.targetDate || null]);
  await client.query(`INSERT INTO savings (user_id, current_savings_cents, savings_goal_cents)
    VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET
    current_savings_cents=EXCLUDED.current_savings_cents, savings_goal_cents=EXCLUDED.savings_goal_cents`,
  [userId, cents(plan.savings.balance), plan.savings.goal === "" ? null : cents(plan.savings.goal)]);

  // These are plan definitions, not payment history. Replace this user's collections in one transaction.
  await client.query("DELETE FROM recurring_bills WHERE user_id = $1", [userId]);
  for (const bill of plan.bills) {
    await client.query(`INSERT INTO recurring_bills (user_id,bill_id,bill_name,amount_cents,bill_repeats,next_due_date)
      VALUES ($1,$2,$3,$4,$5,$6)`, [userId, storedId(userId, bill.id), bill.name, cents(bill.amount), bill.schedule, bill.dueDate]);
  }
  await client.query("DELETE FROM one_time_purchases WHERE user_id = $1", [userId]);
  for (const purchase of plan.purchases) {
    await client.query(`INSERT INTO one_time_purchases (user_id,purchase_id,purchase_name,amount_cents,purchase_date)
      VALUES ($1,$2,$3,$4,$5)`, [userId, storedId(userId, purchase.id), purchase.name, cents(purchase.amount), purchase.date]);
  }
  await client.query("DELETE FROM savings_contributions WHERE user_id = $1", [userId]);
  for (const entry of plan.savings.contributions) {
    await client.query(`INSERT INTO savings_contributions
      (user_id,savings_contr_id,savings_contr_name,amount_cents,savings_schedule,savings_contr_date)
      VALUES ($1,$2,$3,$4,$5,$6)`, [userId, storedId(userId, entry.id), entry.name, cents(entry.amount), entry.schedule, entry.date]);
  }
  await client.query("DELETE FROM savings_coverage_selections WHERE user_id = $1", [userId]);
  for (const date of plan.savingsCoverDates) {
    await client.query("INSERT INTO savings_coverage_selections (user_id,coverage_date) VALUES ($1,$2)", [userId, date]);
  }
}

export class PlanRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async load(userId: string): Promise<PlanSnapshot> {
    return this.transaction("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY", client => readPlan(client, userId));
  }

  async save(userId: string, value: unknown, expectedVersion: string | null): Promise<PlanSnapshot> {
    const plan = normalizePlan(value);
    return this.transaction("BEGIN", async client => {
      // Lock the parent even on the first save, when no planner_settings row exists yet.
      const owner = await client.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [userId]);
      if (owner.rows.length !== 1) throw new Error("The account no longer exists.");
      const current = await readPlan(client, userId);
      if (current.version !== expectedVersion) throw new PlanConflictError();
      await writePlan(client, userId, plan);
      return snapshot(plan);
    });
  }

  private async transaction<T>(begin: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let brokenConnection: Error | undefined;
    try {
      await client.query(begin);
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      // Preserve the original error even if the connection also fails during rollback.
      try { await client.query("ROLLBACK"); } catch (rollbackError) {
        brokenConnection = rollbackError instanceof Error ? rollbackError : new Error("Rollback failed.");
      }
      throw error;
    } finally { client.release(brokenConnection); }
  }
}
