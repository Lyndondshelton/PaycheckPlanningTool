// Calendar-based forecast calculations, plan types, and saved-plan validation.
export const PAY_SCHEDULES = {
  weekly: "Weekly", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Monthly",
} as const;

export const INCOME_BASES = {
  paycheck: "Per paycheck", yearly: "Annual salary", monthly: "Monthly income", weekly: "Weekly income",
} as const;

export const BILL_SCHEDULES = {
  weekly: "Weekly", monthly: "Monthly", semiannually: "Every 6 months", yearly: "Yearly",
} as const;

export const SAVINGS_SCHEDULES = {
  once: "One time", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", payday: "Every payday",
} as const;

export const HORIZONS = [14, 28, 30, 60, 90] as const;

// Keep custom projections bounded so a mistyped year cannot freeze the interactive planner.
export const MAX_FORECAST_DAYS = 365;

export type ForecastRange = (typeof HORIZONS)[number] | "custom";
export type PaySchedule = keyof typeof PAY_SCHEDULES;
export type IncomeBasis = keyof typeof INCOME_BASES;
export type BillSchedule = keyof typeof BILL_SCHEDULES;
export type Bill = {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  schedule: BillSchedule
};
export type Purchase = {
  id: string;
  name: string;
  amount: string;
  date: string
};
export type SavingsContribution = {
  id: string; name: string; amount: string; date: string; schedule: keyof typeof SAVINGS_SCHEDULES;
};
export type SavingsPlan = {
  balance: string;
  goal: string;
  contributions: SavingsContribution[]
};
type contributions = {
  id: string;
  name: string;
  amount: number
}
export type SavingsDay = {
  date: string;
  amount: number;
  balance: number;
  withdrawal?: number;
  contributions: contributions[]
};
export type CoverageDay = {
  beforeCoverage: number;
  available: number | null;
  transferred: number;
  remainingShortfall: number
};
export type PlanForecast = {
  cash: ForecastDay[];
  savings: SavingsDay[];
  coverage: Record<string, CoverageDay>
};
export type Plan = {
  income: string;
  incomeBasis: IncomeBasis;
  paySchedule: PaySchedule;
  nextPayday: string;
  firstPayDay: number;
  secondPayDay: number;
  startingBalance: string;
  startDate: string;
  horizon: ForecastRange;
  targetDate: string;
  bills: Bill[];
  purchases: Purchase[];
  savings: SavingsPlan;
  savingsCoverDates: string[];
};
export type Transaction = {
  id: string;
  name: string;
  kind: "income" | "bill" | "purchase" | "savings";
  amount: number
};
export type ForecastDay = {
  date: string;
  income: number;
  expenses: number;
  balance: number;
  transactions: Transaction[]
};

const DAY = 86_400_000;
const MAX_AMOUNT = 1_000_000_000;
export function dateValue(value: string): number { return Date.parse(`${value}T00:00:00Z`); }
export function dateString(value: number): string { return new Date(value).toISOString().slice(0, 10); }
export function addDays(value: string, days: number): string { return dateString(dateValue(value) + days * DAY); }
export function todayString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isDate(value: string): boolean {
  const time = dateValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(time) && dateString(time) === value
    && value >= "1900-01-01" && value <= "9998-12-31";
}
export function isMoney(value: string, allowNegative = false): boolean {
  return (allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(value)
    && Math.abs(Number(value)) <= MAX_AMOUNT;
}
export function cents(value: string): number { return Math.round(Number(value) * 100); }
export function createPlan(today: string): Plan {
  return { income: "", incomeBasis: "paycheck", paySchedule: "biweekly", nextPayday: today,
    firstPayDay: 1, secondPayDay: 15, startingBalance: "0", startDate: today, horizon: 30, targetDate: "", bills: [], purchases: [], savings: createSavingsPlan(), savingsCoverDates: [] };
}
export function createSavingsPlan(): SavingsPlan { return { balance: "0", goal: "", contributions: [] }; }
// Both preset and custom windows include their first and last calendar dates.
export function forecastDays(plan: Pick<Plan, "horizon" | "startDate" | "targetDate">): number {
  return plan.horizon === "custom" ? (dateValue(plan.targetDate) - dateValue(plan.startDate)) / DAY + 1 : plan.horizon;
}
export function forecastEndDate(plan: Pick<Plan, "horizon" | "startDate" | "targetDate">): string {
  if (!isDate(plan.startDate)) return "";
  const days = forecastDays(plan);
  if (!Number.isInteger(days) || days < 1 || days > MAX_FORECAST_DAYS) return "";
  return addDays(plan.startDate, days - 1);
}
export function paycheckAmount(plan: Plan): number {
  const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[plan.paySchedule];
  const multiplier = { paycheck: periods, yearly: 1, monthly: 12, weekly: 52 }[plan.incomeBasis];
  return Math.round(cents(plan.income) * multiplier / periods);
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
function monthDay(date: Date, day: number): number {
  return Math.min(day, daysInMonth(date.getUTCFullYear(), date.getUTCMonth()));
}
function recurringMonth(date: string, anchor: string, interval: number): boolean {
  if (date < anchor) return false;
  const current = new Date(dateValue(date));
  const first = new Date(dateValue(anchor));
  const months = (current.getUTCFullYear() - first.getUTCFullYear()) * 12 + current.getUTCMonth() - first.getUTCMonth();
  return months % interval === 0 && current.getUTCDate() === monthDay(current, first.getUTCDate());
}
function paydayCount(date: string, plan: Plan): number {
  if (date < plan.nextPayday) return 0;
  if (plan.paySchedule === "monthly") return Number(recurringMonth(date, plan.nextPayday, 1));
  if (plan.paySchedule === "semimonthly") {
    const current = new Date(dateValue(date));
    return [plan.firstPayDay, plan.secondPayDay].filter(day => current.getUTCDate() === monthDay(current, day)).length;
  }
  return Number(((dateValue(date) - dateValue(plan.nextPayday)) / DAY) % (plan.paySchedule === "weekly" ? 7 : 14) === 0);
}
// Shared by the purchase form and forecast validation so saved entries follow the same rules.
export function purchaseError(purchase: Omit<Purchase, "id">): string | undefined {
  if (!purchase.name.trim() || purchase.name.trim().length > 80) return "Enter a purchase name of 1–80 characters.";
  if (!isMoney(purchase.amount) || cents(purchase.amount) <= 0) return "Enter a positive amount, up to 1 billion, with up to 2 decimals.";
  if (!isDate(purchase.date)) return "Choose a valid purchase date (1900–9998).";
}
export function savingsContributionError(contribution: Omit<SavingsContribution, "id">): string | undefined {
  const error = purchaseError(contribution);
  if (error) return error.replace("purchase", "contribution");
  if (!Object.hasOwn(SAVINGS_SCHEDULES, contribution.schedule)) return "Choose a valid contribution schedule.";
}
export function savingsErrors(savings: SavingsPlan): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMoney(savings.balance)) errors.savingsBalance = "Enter a savings balance from 0 to 1 billion, with up to 2 decimals.";
  if (savings.goal !== "" && (!isMoney(savings.goal) || cents(savings.goal) <= 0)) errors.savingsGoal = "Enter a positive goal amount, or leave it empty.";
  if (savings.contributions.some(item => savingsContributionError(item))) errors.savingsContributions = "A saved contribution has invalid details. Edit or remove it to continue.";
  return errors;
}

export function savingsProjectionErrors(plan: Plan): Record<string, string> {
  const errors = savingsErrors(plan.savings);
  const cashErrors = planErrors(plan);
  const required = ["startDate", "horizon", "targetDate"];
  if (plan.savings.contributions.some(item => item.schedule === "payday")) required.push("nextPayday", "payDays");
  for (const key of required) if (cashErrors[key]) errors[key] = cashErrors[key];
  return errors;
}

// Compare the greatest cash deficit to current savings only. Planned deposits are not money on hand.
export function savingsCoverage(currentSavings: string, lowestCashBalance: number) {
  if (!isMoney(currentSavings) || !Number.isFinite(lowestCashBalance)) return null;
  const available = cents(currentSavings);
  const shortfall = Math.max(0, -lowestCashBalance);
  return {
    available, shortfall,
    covered: available >= shortfall,
    remaining: Math.max(0, available - shortfall),
    uncovered: Math.max(0, shortfall - available),
  };
}

// Scheduled contributions project growth; they never overwrite the manually entered current balance.
function scheduledSavings(plan: Plan): SavingsDay[] {
  if (Object.keys(savingsProjectionErrors(plan)).length) return [];
  const days = forecastDays(plan);
  if (!Number.isInteger(days) || days < 1 || days > MAX_FORECAST_DAYS || (plan.horizon === "custom" && !isDate(plan.targetDate))) return [];
  let balance = cents(plan.savings.balance);
  const result: SavingsDay[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(plan.startDate, offset);
    const contributions: SavingsDay["contributions"] = [];
    for (const item of plan.savings.contributions) {
      if (date < item.date) continue;
      const elapsed = (dateValue(date) - dateValue(item.date)) / DAY;
      let count = 0;
      switch (item.schedule) {
        case "once": count = Number(date === item.date); break;
        case "weekly": count = Number(elapsed % 7 === 0); break;
        case "biweekly": count = Number(elapsed % 14 === 0); break;
        case "monthly": count = Number(recurringMonth(date, item.date, 1)); break;
        case "payday":
          count = paydayCount(date, plan);
          break;
      }
      for (let index = 0; index < count; index++) contributions.push({ id: `${item.id}:${index}`, name: item.name, amount: cents(item.amount) });
    }
    if (!contributions.length) continue;
    const amount = contributions.reduce((sum, item) => sum + item.amount, 0);
    balance += amount;
    result.push({ date, amount, balance, contributions });
  }
  return result;
}
export function planErrors(plan: Plan): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isMoney(plan.income)) errors.income = "Enter an amount from 0 to 1 billion, with up to 2 decimals.";
  if (!isMoney(plan.startingBalance, true)) errors.startingBalance = "Enter a balance with up to 2 decimals (negative is allowed).";
  if (!isDate(plan.startDate)) errors.startDate = "Choose a valid forecast start date (1900–9998).";
  if (!isDate(plan.nextPayday)) errors.nextPayday = "Choose a valid next payday (1900–9998).";
  if (plan.horizon === "custom") {
    if (!isDate(plan.targetDate)) errors.targetDate = "Choose a valid target date (1900–9998).";
    else if (isDate(plan.startDate)) {
      const days = forecastDays(plan);
      if (days < 1) errors.targetDate = "Target date must be on or after the forecast start date.";
      else if (days > MAX_FORECAST_DAYS) errors.targetDate = `Choose a target within ${MAX_FORECAST_DAYS.toLocaleString("en-US")} days of the forecast start.`;
    }
  } else if (!HORIZONS.some(days => days === plan.horizon)) errors.horizon = "Choose a preset range or a custom target date.";
  if (plan.paySchedule === "semimonthly") {
    if (![plan.firstPayDay, plan.secondPayDay].every(day => Number.isInteger(day) && day >= 1 && day <= 31)
      || plan.firstPayDay >= plan.secondPayDay) errors.payDays = "Choose two different days in ascending order, from 1 to 31.";
    else if (isDate(plan.nextPayday)) {
      const date = new Date(dateValue(plan.nextPayday));
      if (![plan.firstPayDay, plan.secondPayDay].some(day => date.getUTCDate() === monthDay(date, day))) {
        errors.nextPayday = "Next payday must match one of your two monthly pay days.";
      }
    }
  }
  if (plan.bills.some(bill => !bill.name.trim() || !isMoney(bill.amount) || cents(bill.amount) <= 0 || !isDate(bill.dueDate))) {
    errors.bills = "A saved bill has invalid details. Edit or remove it to continue.";
  }
  if (plan.purchases.some(purchase => purchaseError(purchase))) {
    errors.purchases = "A saved purchase has invalid details. Edit or remove it to continue.";
  }
  return errors;
}
function scheduledCash(plan: Plan): ForecastDay[] {
  if (Object.keys(planErrors(plan)).length) return [];
  let balance = cents(plan.startingBalance);
  const result: ForecastDay[] = [];
  const pay = paycheckAmount(plan);
  const days = forecastDays(plan);
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(plan.startDate, offset);
    const transactions: Transaction[] = [];
    if (pay > 0) {
      for (let index = 0; index < paydayCount(date, plan); index++) {
        transactions.push({ id: `paycheck-${index}`, name: "Paycheck", kind: "income", amount: pay });
      }
    }
    for (const bill of plan.bills) {
      const due = bill.schedule === "weekly"
        ? date >= bill.dueDate && ((dateValue(date) - dateValue(bill.dueDate)) / DAY) % 7 === 0
        : recurringMonth(date, bill.dueDate, { monthly: 1, semiannually: 6, yearly: 12 }[bill.schedule]);
      if (due) transactions.push({ id: bill.id, name: bill.name, kind: "bill", amount: cents(bill.amount) });
    }
    // Exact date matching charges a purchase once, without replaying purchases before the forecast.
    for (const purchase of plan.purchases) {
      if (date === purchase.date) transactions.push({ id: `purchase:${purchase.id}`, name: purchase.name, kind: "purchase", amount: cents(purchase.amount) });
    }
    if (!transactions.length) continue;
    const income = transactions.filter(item => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter(item => item.kind !== "income").reduce((sum, item) => sum + item.amount, 0);
    balance += income - expenses;
    result.push({ date, income, expenses, balance, transactions });
  }
  return result;
}

// Process both ledgers together: deposits arrive first, then selected coverage draws only that day's
// available savings. Recalculation makes checkbox changes reversible without editing opening balances.
export function forecastPlan(plan: Plan): PlanForecast {
  const cash = scheduledCash(plan);
  const savings = scheduledSavings(plan);
  if (Object.keys(planErrors(plan)).length) return { cash, savings, coverage: {} };

  const savingsValid = Object.keys(savingsProjectionErrors(plan)).length === 0;
  const cashByDate = new Map(cash.map(row => [row.date, row]));
  const savingsByDate = new Map(savings.map(row => [row.date, row]));
  const end = forecastEndDate(plan);
  const selected = new Set(plan.savingsCoverDates.filter(date => date >= plan.startDate && date <= end));
  const dates = new Set([...cashByDate.keys(), ...savingsByDate.keys(), ...selected]);
  let cashBalance = cents(plan.startingBalance);
  let savingsBalance = savingsValid ? cents(plan.savings.balance) : 0;
  // An opening deficit needs a day on which the user can request coverage even without other entries.
  if (cashBalance < 0) dates.add(plan.startDate);
  const result: PlanForecast = { cash: [], savings: [], coverage: {} };

  for (const date of [...dates].sort()) {
    const cashDay = cashByDate.get(date);
    const savingsDay = savingsByDate.get(date);
    savingsBalance += savingsDay?.amount ?? 0;
    cashBalance += (cashDay?.income ?? 0) - (cashDay?.expenses ?? 0);
    const beforeCoverage = cashBalance;
    const available = savingsValid ? savingsBalance : null;
    const transfer = selected.has(date) && beforeCoverage < 0 && available !== null
      ? Math.min(-beforeCoverage, available) : 0;
    cashBalance += transfer;
    savingsBalance -= transfer;

    if (cashDay || selected.has(date) || (date === plan.startDate && beforeCoverage < 0)) {
      result.coverage[date] = { beforeCoverage, available, transferred: transfer, remainingShortfall: Math.max(0, -cashBalance) };
      const transactions = [...(cashDay?.transactions ?? [])];
      if (transfer > 0) transactions.push({ id: `savings-cover:${date}`, name: "Transfer from savings", kind: "savings", amount: transfer });
      // Savings transfers affect the running balance but are not salary or bill/purchase spending.
      result.cash.push({ date, income: cashDay?.income ?? 0, expenses: cashDay?.expenses ?? 0, balance: cashBalance, transactions });
    }
    if (savingsDay || transfer > 0) {
      result.savings.push({ date, amount: savingsDay?.amount ?? 0, balance: savingsBalance,
        contributions: savingsDay?.contributions ?? [], ...(transfer > 0 ? { withdrawal: transfer } : {}) });
    }
  }
  return result;
}

export function forecast(plan: Plan): ForecastDay[] { return forecastPlan(plan).cash; }
export function forecastSavings(plan: Plan): SavingsDay[] { return forecastPlan(plan).savings; }

// Storage is untrusted: reject incompatible records before using them in the planner.
export function isSavedPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["income", "nextPayday", "startingBalance", "startDate"].every(key => typeof item[key] === "string")
    && typeof item.incomeBasis === "string" && Object.hasOwn(INCOME_BASES, item.incomeBasis)
    && typeof item.paySchedule === "string" && Object.hasOwn(PAY_SCHEDULES, item.paySchedule)
    && typeof item.firstPayDay === "number" && typeof item.secondPayDay === "number"
    && (item.horizon === "custom" || (typeof item.horizon === "number" && HORIZONS.some(days => days === item.horizon)))
    && typeof item.targetDate === "string"
    && Array.isArray(item.bills) && item.bills.every(bill => bill && typeof bill === "object"
      && ["id", "name", "amount", "dueDate"].every(key => typeof bill[key] === "string")
      && typeof bill.schedule === "string" && Object.hasOwn(BILL_SCHEDULES, bill.schedule))
    && new Set(item.bills.map(bill => bill.id)).size === item.bills.length
    && Array.isArray(item.purchases) && item.purchases.every(purchase => purchase && typeof purchase === "object"
      && ["id", "name", "amount", "date"].every(key => typeof purchase[key] === "string"))
    && new Set(item.purchases.map(purchase => purchase.id)).size === item.purchases.length
    && isSavedSavings(item.savings)
    && Array.isArray(item.savingsCoverDates) && item.savingsCoverDates.every(date => typeof date === "string" && isDate(date))
    && new Set(item.savingsCoverDates).size === item.savingsCoverDates.length;
}

function isSavedSavings(value: unknown): value is SavingsPlan {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.balance === "string" && typeof item.goal === "string"
    && Array.isArray(item.contributions) && item.contributions.every(entry => entry && typeof entry === "object"
      && ["id", "name", "amount", "date"].every(key => typeof entry[key] === "string")
      && typeof entry.schedule === "string" && Object.hasOwn(SAVINGS_SCHEDULES, entry.schedule))
    && new Set(item.contributions.map(entry => entry.id)).size === item.contributions.length;
}

// Add only missing fields from earlier schemas; preserve dates, income, bills, and purchases.
export function restorePlan(value: unknown): Plan | null {
  if (!value || typeof value !== "object") return null;
  const candidate = {
    ...value,
    ...(!Object.hasOwn(value, "purchases") ? { purchases: [] } : {}),
    ...(!Object.hasOwn(value, "targetDate") ? { targetDate: "" } : {}),
    ...(!Object.hasOwn(value, "savings") ? { savings: createSavingsPlan() } : {}),
    ...(!Object.hasOwn(value, "savingsCoverDates") ? { savingsCoverDates: [] } : {}),
  };
  return isSavedPlan(candidate) ? candidate : null;
}
