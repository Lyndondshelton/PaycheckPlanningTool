import type { Transaction } from "@/lib/planner/planner";

// One set of labels and CSS hooks keeps the legend, transactions, and warnings consistent.
export const EVENT_LABELS = {
  income: "Income",
  bill: "Bill",
  purchase: "One-time purchase",
  savings: "Savings transfer",
  overdraft: "Potential overdraft",
} satisfies Record<Transaction["kind"] | "overdraft", string>;

type EventKind = keyof typeof EVENT_LABELS;

export function EventBadge({ kind }: { kind: EventKind }) {
  return <span className={`event-badge event-${kind}`}>{EVENT_LABELS[kind]}</span>;
}

export function EventLegend() {
  return (
    <ul className="event-legend" aria-label="Financial event colors">
      {(Object.keys(EVENT_LABELS) as EventKind[]).map(kind => (
        <li key={kind} className={`event-${kind}`}><span className="event-dot" aria-hidden="true" />{EVENT_LABELS[kind]}</li>
      ))}
    </ul>
  );
}
