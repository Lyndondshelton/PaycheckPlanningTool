import { Fragment, useId } from "react";
import { cents, dateValue, forecastDays, forecastEndDate, type CoverageDay, type ForecastDay, type Plan } from "@/lib/planner/planner";
import { formatDate, money, weekday } from "@/lib/formatting/format";
import { EventBadge, EventLegend } from "./event-badge";
import { Icon } from "./ui";
import { SavingsCoverageControl } from "./savings-coverage-control";

function BalanceChart({ rows, plan }: { rows: ForecastDay[]; plan: Plan }) {
  const chartId = useId();
  const initial = cents(plan.startingBalance);
  const values = [initial, ...rows.map(row => row.balance)];
  const low = Math.min(0, ...values);
  const high = Math.max(10000, ...values);
  const days = forecastDays(plan);
  const endDate = forecastEndDate(plan);
  const ending = values[values.length - 1];
  const y = (value: number) => 24 + (high - value) / (high - low) * 116;
  // A one-day custom forecast has a zero-length date span but still shows its closing balance.
  const x = (date: string) => 92 + (dateValue(date) - dateValue(plan.startDate)) / (86_400_000 * Math.max(days - 1, 1)) * 620;
  let path = `M 92 ${y(initial)}`;
  for (const row of rows) path += ` H ${x(row.date)} V ${y(row.balance)}`;
  path += " H 712";

  return (
    <div className="chart">
      <svg viewBox="0 0 740 180" role="img" aria-labelledby={`${chartId}-title ${chartId}-desc`}>
        <title id={`${chartId}-title`}>Projected balance over {days} {days === 1 ? "day" : "days"}</title>
        <desc id={`${chartId}-desc`}>Starting at {money(initial)} and ending at {money(ending)}. Red portions show a negative balance. The table below lists every transaction day.</desc>
        <defs><clipPath id={`${chartId}-negative`}><rect x="90" y={y(0)} width="625" height={Math.max(0, 144 - y(0))} /></clipPath></defs>
        {[high, (high + low) / 2, low].map((value, index) => (
          <g key={index}>
            <line x1="92" x2="712" y1={y(value)} y2={y(value)} stroke="currentColor" className="chart-grid" />
            <text x="0" y={y(value) + 4}>{money(value)}</text>
          </g>
        ))}
        {low < 0 && <line x1="92" x2="712" y1={y(0)} y2={y(0)} stroke="var(--danger)" strokeDasharray="4 5" opacity=".65" />}
        <path d={path} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" />
        {low < 0 && <path d={path} fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinejoin="round" clipPath={`url(#${chartId}-negative)`} />}
        <circle cx="712" cy={y(ending)} r="4" fill={ending < 0 ? "var(--danger)" : "var(--green)"} />
        <text x="92" y="171">{formatDate(plan.startDate)}</text>
        <text x="712" y="171" textAnchor="end">{formatDate(endDate)}</text>
      </svg>
    </div>
  );
}

export function ForecastTimeline({ rows, plan, lowest, coverage, onCoverageChange }: {
  rows: ForecastDay[]; plan: Plan; lowest: number; coverage: Record<string, CoverageDay>;
  onCoverageChange: (date: string, checked: boolean) => void;
}) {
  const opening = cents(plan.startingBalance);
  const days = forecastDays(plan);
  const endDate = forecastEndDate(plan);

  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-heading">
      <div className="timeline-heading">
        <div><h2 id="timeline-heading">Your transaction timeline</h2><p>{formatDate(plan.startDate, true)} – {formatDate(endDate, true)}</p></div>
        <span className="window-badge">{days} day view</span>
      </div>
      <EventLegend />
      <BalanceChart rows={rows} plan={plan} />
      <div className="timeline-caption">
        <span>Transaction days only</span>
        <span>Lowest balance <strong className={lowest < 0 ? "negative" : ""}>{money(lowest)}</strong></span>
      </div>
      {!rows.length ? (
        <div className="no-transactions">
          <Icon name="calendar" size={25} /><h3>No transactions in this window</h3>
          <p>Your balance stays at {money(opening)}. Add a bill or purchase, or choose a longer forecast.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="forecast-table">
            <caption className="sr-only">Income, bills, one-time purchases, and closing balances on days with transactions. Potential overdrafts mark days ending below zero.</caption>
            <colgroup><col style={{ width: "56%" }} /><col style={{ width: "21%" }} /><col style={{ width: "23%" }} /></colgroup>
            <thead><tr><th scope="col">Date & transaction</th><th scope="col">In / out</th><th scope="col">Balance</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <Fragment key={row.date}>
                  <tr className={`forecast-day${row.balance < 0 ? " overdraft-day" : ""}`}>
                    <td colSpan={2}>
                      <div className="transaction-date"><time dateTime={row.date}>{formatDate(row.date)}</time><span>{weekday(row.date)}</span></div>
                      <div className="transaction-list">
                        {row.transactions.length === 0 && <p className="text-[11px] leading-relaxed text-[var(--muted)]">{row.balance < 0 ? "Opening or carried balance below zero." : "No transfer needed on this date."}</p>}
                        {row.transactions.map(transaction => (
                          <div key={transaction.id} className={`transaction-item event-${transaction.kind}`}>
                            <div className="transaction-name"><strong>{transaction.name}</strong><EventBadge kind={transaction.kind} /></div>
                            <span className="transaction-amount">{transaction.kind === "income" || transaction.kind === "savings" ? "+" : "−"}{money(transaction.amount)}</span>
                          </div>
                        ))}
                      </div>

                    </td>
                    <td className="balance-cell">
                      <strong className={row.balance < 0 ? "negative" : ""}>{money(row.balance)}</strong>
                      <span>End of day</span>
                      {row.balance < 0 && <EventBadge kind="overdraft" />}
                      {/* Only the placement for the current screen width is visible or focusable. */}
                      {(row.balance < 0 || plan.savingsCoverDates.includes(row.date)) && <div className="hidden sm:block">
                        <SavingsCoverageControl date={row.date} balance={row.balance} selected={plan.savingsCoverDates.includes(row.date)} coverage={coverage[row.date]} onChange={onCoverageChange} />
                      </div>}

                    </td>
                  </tr>
                  {(row.balance < 0 || plan.savingsCoverDates.includes(row.date)) && <tr className="coverage-row sm:hidden" data-coverage-date={row.date}>
                    <td colSpan={3}>
                      <SavingsCoverageControl date={row.date} balance={row.balance} selected={plan.savingsCoverDates.includes(row.date)} coverage={coverage[row.date]} onChange={onCoverageChange} />
                    </td>
                  </tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="timeline-footer"><Icon name="wallet" size={16} /><p>Starting with <strong>{money(opening)}</strong>. Balances carry forward between transaction days.</p></div>
    </section>
  );
}
