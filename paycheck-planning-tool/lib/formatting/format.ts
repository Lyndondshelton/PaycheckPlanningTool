import { dateValue } from "../planner/planner";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(cents: number): string {
  return currency.format(cents / 100);
}

// Planner dates represent calendar dates rather than instants in the visitor's time zone.
export function formatDate(value: string, long = false): string {
  return new Intl.DateTimeFormat("en-US", {
    month: long ? "long" : "short", day: "numeric", year: long ? "numeric" : undefined, timeZone: "UTC",
  }).format(new Date(dateValue(value)));
}

export function weekday(value: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(dateValue(value)));
}
