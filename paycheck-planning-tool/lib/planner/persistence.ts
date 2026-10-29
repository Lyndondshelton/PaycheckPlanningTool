// Shared by the browser and API: validate the whole plan before a database save.
import { cents, isDate, isSavedPlan, planErrors, savingsErrors, type Plan } from "./planner.ts";

export type PlanSnapshot = { plan: Plan | null; version: string | null };

export class PlanValidationError extends Error {}

/** Match the database's case-sensitive uniqueness rules after trimming names. */
export function planSaveError(value: unknown): string | undefined {
  if (!isSavedPlan(value)) return "The plan has an invalid format. Reload the page and try again.";
  const error = Object.values({ ...planErrors(value), ...savingsErrors(value.savings) })[0];
  if (error) return error;
  if (value.targetDate && !isDate(value.targetDate)) return "Choose a valid custom target date, or clear it.";
  for (const [entries, label, keys] of [
    [value.bills, "bill", value.bills.map(item => item.name.trim())],
    [value.purchases, "purchase", value.purchases.map(item => JSON.stringify([item.name.trim(), item.date]))],
    [value.savings.contributions, "contribution", value.savings.contributions.map(item => item.name.trim())],
  ] as const) {
    if (entries.some(item => !item.id || item.id.length > 200 || item.id.includes("\0")
      || !item.name.trim() || item.name.trim().length > 80 || item.name.includes("\0"))) {
      return `Each ${label} needs a valid ID and a name of 1–80 characters.`;
    }
    if (new Set(keys).size !== keys.length) {
      return label === "purchase" ? "Purchase names must be unique on the same date."
        : `Each ${label} must have a different name within your account.`;
    }
  }
}

/** Stable field order, cents, and row order make version hashes independent of SQL ordering. */
export function normalizePlan(value: unknown): Plan {
  const error = planSaveError(value);
  if (error) throw new PlanValidationError(error);
  const plan = value as Plan;
  const amount = (input: string) => (cents(input) / 100).toFixed(2);
  const day = (input: number, fallback: number) => Number.isInteger(input) && input >= 1 && input <= 31 ? input : fallback;
  const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return {
    income: amount(plan.income), incomeBasis: plan.incomeBasis, paySchedule: plan.paySchedule,
    nextPayday: plan.nextPayday, firstPayDay: day(plan.firstPayDay, 1), secondPayDay: day(plan.secondPayDay, 15),
    startingBalance: amount(plan.startingBalance), startDate: plan.startDate,
    horizon: plan.horizon, targetDate: plan.targetDate,
    bills: plan.bills.map(item => ({ id: item.id, name: item.name.trim(), amount: amount(item.amount), dueDate: item.dueDate, schedule: item.schedule })).sort(byId),
    purchases: plan.purchases.map(item => ({ id: item.id, name: item.name.trim(), amount: amount(item.amount), date: item.date })).sort(byId),
    savings: {
      balance: amount(plan.savings.balance), goal: plan.savings.goal === "" ? "" : amount(plan.savings.goal),
      contributions: plan.savings.contributions.map(item => ({ id: item.id, name: item.name.trim(), amount: amount(item.amount), date: item.date, schedule: item.schedule })).sort(byId),
    },
    savingsCoverDates: [...plan.savingsCoverDates].sort(),
  };
}
