"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  headingId: string;
  title: string;
  count: number;
  number: string;
  kind: "bill" | "purchase";
  description: string;
  transactions: ReactNode;
  children: ReactNode;
};

// Collapse only saved transactions; the add/edit form stays visible and retains its draft.
export function CollapsibleSection({ headingId, title, count, number, kind, description, transactions, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <section className="panel" aria-labelledby={headingId}>
      <h2 id={headingId}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          className="flex min-h-20 w-full items-start gap-3 rounded-xl bg-transparent px-4 py-5 text-left hover:bg-[#f7f9f4] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#76a389] sm:px-6"
          onClick={() => setExpanded(previous => !previous)}
        >
          <span className={`section-number event-${kind}`} aria-hidden="true">{number}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1">
              <span>{title}</span><span className="count" aria-label={`${count} saved transactions`}>{count}</span>
            </span>
            <span className="mt-1.5 block text-xs font-normal leading-relaxed text-[var(--muted)]">
              {expanded ? description : "Expand to view saved transactions."}
            </span>
          </span>
          <svg className={`mt-1 shrink-0 text-[var(--muted)] transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>
      <div id={contentId} hidden={!expanded}>
        {transactions}
      </div>
      <div className={expanded ? "mt-1 border-t border-[var(--border)] pt-[18px]" : undefined}>{children}</div>
    </section>
  );
}
