"use client";

import { useRef, useState, type FormEvent } from "react";
import { cents, forecastEndDate, isDate, isMoney, SAVINGS_SCHEDULES,
  savingsContributionError, savingsCoverage, savingsProjectionErrors,
  type Plan, type PlanForecast, type SavingsContribution, type SavingsPlan } from "@/lib/planner/planner";
import { formatDate, money } from "@/lib/formatting/format";
import { Field, Icon } from "./ui";

type Props = { plan: Plan; projection: PlanForecast; lowestCashBalance: number | null; onChange: (savings: SavingsPlan) => void; onNotice: (notice: string) => void };
const emptyDraft = () => ({ name: "", amount: "", date: "", schedule: "monthly" as SavingsContribution["schedule"] });

function GoalProgress({ label, amount, goal, projected = false }: { label: string; amount: number; goal: number; projected?: boolean }) {
  const percent = Math.min(100, Math.round(amount / goal * 100));
  return <div className="space-y-1.5">
    <div className="flex justify-between gap-2 text-[11px]"><span>{label}</span><strong>{percent}%</strong></div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${money(amount)} of ${money(goal)}`} className="h-2 overflow-hidden rounded-full bg-[#e2eeea]">
      <div className={`h-full rounded-full ${projected ? "bg-[#76a99c]" : "bg-[#27614b]"}`} style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

export function SavingsSection({ plan, projection, lowestCashBalance, onChange, onNotice }: Props) {
  const savings = plan.savings;
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const errors = savingsProjectionErrors(plan);
  const valid = Object.keys(errors).length === 0;
  const rows = valid ? projection.savings : [];
  const current = isMoney(savings.balance) ? cents(savings.balance) : 0;
  const projected = rows.length ? rows[rows.length - 1].balance : current;
  const deposits = rows.reduce((sum, row) => sum + row.amount, 0);
  const transferred = rows.reduce((sum, row) => sum + (row.withdrawal ?? 0), 0);
  const hasCoverageSelections = Object.keys(projection.coverage).some(date => plan.savingsCoverDates.includes(date));
  const goal = isMoney(savings.goal) && cents(savings.goal) > 0 ? cents(savings.goal) : null;
  const endDate = forecastEndDate(plan);
  const coverage = lowestCashBalance === null ? null : savingsCoverage(savings.balance, lowestCashBalance);
  const reached = goal === null ? undefined : rows.find(row => row.balance >= goal)?.date;
  const sorted = [...savings.contributions].sort((a, b) => a.date.localeCompare(b.date));

  function clearDraft() { setDraft(emptyDraft()); setEditingId(null); setFormError(""); }
  function saveContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = savingsContributionError(draft);
    if (error) { setFormError(error); return; }
    // Enforce the account's unique contribution names before attempting a cloud save.
    if (savings.contributions.some(item => item.id !== editingId && item.name === draft.name.trim())) {
      setFormError("A contribution with this name already exists. Edit it or choose another name."); return;
    }
    const contribution = { ...draft, name: draft.name.trim(), id: editingId ?? crypto.randomUUID() };
    onChange({ ...savings, contributions: editingId ? savings.contributions.map(item => item.id === editingId ? contribution : item) : [...savings.contributions, contribution] });
    onNotice(`${contribution.name} savings contribution ${editingId ? "updated" : "added"}.`);
    clearDraft(); nameRef.current?.focus();
  }

  return (
    <aside className="panel min-w-0" aria-labelledby="savings-heading">
      <div className="flex items-start gap-3 px-4 pb-5 pt-6 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e5f1ec] text-[#27614b]"><Icon name="wallet" size={18} /></span>
        <div><h2 id="savings-heading">Your savings</h2><p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">A separate view of your financial cushion.</p></div>
      </div>
      <div className="space-y-5 px-4 pb-6 sm:px-6">
        <Field id="savings-balance" label="Current savings balance" error={errors.savingsBalance} hint="Savings on the forecast start date, before planned deposits.">
          <div className="money-input"><span aria-hidden="true">$</span><input id="savings-balance" type="number" min="0" max="1000000000" step="0.01" value={savings.balance} onChange={event => onChange({ ...savings, balance: event.target.value })} aria-invalid={!!errors.savingsBalance} aria-describedby="savings-balance-hint" /></div>
        </Field>
        <Field id="savings-goal" label="Savings goal (optional)" error={errors.savingsGoal} hint="Set a target to track your progress.">
          <div className="money-input"><span aria-hidden="true">$</span><input id="savings-goal" type="number" min="0.01" max="1000000000" step="0.01" placeholder="e.g. 5000" value={savings.goal} onChange={event => onChange({ ...savings, goal: event.target.value })} aria-invalid={!!errors.savingsGoal} aria-describedby="savings-goal-hint" /></div>
        </Field>
        {valid ? <div className="space-y-4 rounded-lg border border-[#d7e6dd] bg-[#f2f7f1] p-4">
          <div><p className="text-[11px] text-[var(--muted)]">Projected savings</p><strong id="projected-savings" className="mt-2 block break-words text-2xl font-medium tracking-tight">{money(projected)}</strong><p className="mt-1 text-[10px] text-[var(--muted)]">On {formatDate(endDate, true)}</p></div>
          <p className="text-xs text-[#27614b]">+{money(deposits)} in planned contributions</p>
          {transferred > 0 && <p className="text-xs text-[#1b747c]">−{money(transferred)} in planned overdraft coverage</p>}
          {goal !== null && <div className="space-y-3 border-t border-[#d7e6dd] pt-3">
            <GoalProgress label="Saved now" amount={current} goal={goal} />
            <GoalProgress label="Projected progress" amount={projected} goal={goal} projected />
            <p className="text-[11px] leading-relaxed">{current >= goal ? "Your current savings meet your goal." : reached ? `Goal projected to be reached on ${formatDate(reached, true)}.` : `${money(Math.max(0, goal - projected))} still to save after this forecast.`}</p>
          </div>}
        </div> : <p className="field-error" role="status">Check the savings fields or forecast dates to see projected savings.{errors.nextPayday || errors.payDays ? " Every-payday contributions need a valid pay schedule." : ""}</p>}

        {/* Explicit selections use the same chronological ledger as the main forecast. */}
        <section aria-labelledby="savings-coverage-heading" className={`rounded-lg border p-4 ${coverage && coverage.shortfall > 0 && (hasCoverageSelections || !coverage.covered) ? "border-[#eed5c9] bg-[#fff5ef]" : "border-[var(--border)] bg-[#fafbf8]"}`}>
          <h3 id="savings-coverage-heading">Savings coverage</h3>
          {hasCoverageSelections ? <div className="mt-2 space-y-2 text-xs leading-relaxed" id="savings-coverage-status">
            <p>Planned transfers to cover overdrafts: {money(transferred)}.</p>
            {valid && <p>Projected savings remaining: {money(projected)}.</p>}
            {lowestCashBalance !== null && lowestCashBalance < 0 ? <p className="font-semibold text-[var(--danger)]">Action needed: a projected shortfall of {money(-lowestCashBalance)} remains. Review other overdraft days and your funding.</p> : <p>No remaining projected shortfall.</p>}
          </div> : !coverage ? <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">Enter valid savings and forecast details to compare your cushion.</p> : coverage.shortfall === 0 ? <p className="mt-2 text-xs leading-relaxed" id="savings-coverage-status">No projected shortfall. Your current {money(coverage.available)} in savings remains a separate cushion.</p> : <div className="mt-2 space-y-2 text-xs leading-relaxed" id="savings-coverage-status">
            <p>Largest projected shortfall: <strong>{money(coverage.shortfall)}</strong>.</p>
            <p>{coverage.covered ? `Current savings could cover it, leaving ${money(coverage.remaining)} in savings.` : `Current savings would leave ${money(coverage.uncovered)} uncovered.`}</p>
          </div>}
          <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted)]">{hasCoverageSelections ? "Selected coverage uses projected savings available on each date, including that day's contributions. Opening balances are unchanged." : "This comparison uses savings you have now. Select “cover with savings” on an overdraft day to plan a transfer using projected savings available then."}</p>
        </section>

        <details className="rounded-lg border border-[var(--border)]">
          <summary className="cursor-pointer px-3 py-3 text-xs font-semibold">Planned contributions <span className="count" id="savings-contribution-count">{savings.contributions.length}</span></summary>
          {!sorted.length ? <p className="px-3 pb-3 text-xs text-[var(--muted)]">No planned contributions yet.</p> : <ul className="m-0 list-none px-3" id="savings-contribution-list">{sorted.map(item => <li key={item.id} className="border-t border-[var(--border)] py-3">
            <div className="flex items-start justify-between gap-2 text-xs"><strong className="min-w-0 break-words">{item.name}</strong><span className="shrink-0">{isMoney(item.amount) ? money(cents(item.amount)) : "Invalid"}</span></div>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">{SAVINGS_SCHEDULES[item.schedule]} · from {isDate(item.date) ? formatDate(item.date, true) : "invalid date"}</p>
            <div className="mt-2 flex gap-4"><button type="button" className="text-button" aria-label={`Edit savings ${item.name}`} onClick={() => { setEditingId(item.id); setDraft({ name: item.name, amount: item.amount, date: item.date, schedule: item.schedule }); setFormError(""); nameRef.current?.focus(); }}>Edit</button><button type="button" className="text-button" aria-label={`Remove savings ${item.name}`} onClick={() => { onChange({ ...savings, contributions: savings.contributions.filter(entry => entry.id !== item.id) }); if (editingId === item.id) clearDraft(); onNotice(`${item.name} savings contribution removed.`); }}>Remove</button></div>
          </li>)}</ul>}
        </details>
        {errors.savingsContributions && <p className="field-error">{errors.savingsContributions}</p>}
        <form className="savings-form space-y-4" onSubmit={saveContribution}>
          <h3>{editingId ? "Edit contribution" : "Plan a contribution"}</h3>
          <Field id="savings-name" label="Contribution name"><input ref={nameRef} id="savings-name" required maxLength={80} placeholder="e.g. Emergency fund" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field>
          <Field id="savings-amount" label="Amount"><div className="money-input"><span aria-hidden="true">$</span><input id="savings-amount" type="number" required min="0.01" max="1000000000" step="0.01" placeholder="0.00" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></div></Field>
          <Field id="savings-schedule" label="Repeats"><select id="savings-schedule" value={draft.schedule} onChange={event => setDraft({ ...draft, schedule: event.target.value as SavingsContribution["schedule"] })}>{Object.entries(SAVINGS_SCHEDULES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field id="savings-date" label={draft.schedule === "payday" ? "Start saving on or after" : "Next contribution date"} hint={draft.schedule === "payday" ? "Uses your pay schedule, starting with the first eligible payday." : "Contribution dates follow the same calendar rules as bills."}><input id="savings-date" type="date" required min="1900-01-01" max="9998-12-31" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} aria-describedby="savings-date-hint" /></Field>
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <div className="button-row"><button className="button button-secondary" type="submit"><Icon name={editingId ? "check" : "plus"} size={16} />{editingId ? "Save changes" : "Add contribution"}</button>{editingId && <button className="text-button" type="button" onClick={clearDraft}>Cancel</button>}</div>
        </form>
        {valid && rows.length > 0 && <details className="rounded-lg border border-[var(--border)]">
          <summary className="cursor-pointer px-3 py-3 text-xs font-semibold">Projected savings timeline</summary>
          <ol className="m-0 max-h-80 list-none overflow-y-auto px-3" id="savings-timeline">{rows.map(row => <li key={row.date} className="border-t border-[var(--border)] py-3 text-xs">
            <time dateTime={row.date}>{formatDate(row.date)}</time>
            {row.amount > 0 && <p className="mt-1 text-[#27614b]">Contributions: +{money(row.amount)}</p>}
            {row.contributions.length > 0 && <p className="mt-1 text-[10px] text-[var(--muted)]">{row.contributions.map(item => item.name).join(", ")}</p>}
            {(row.withdrawal ?? 0) > 0 && <p className="mt-1 text-[#1b747c]">Overdraft coverage: −{money(row.withdrawal ?? 0)}</p>}
            <p className="mt-1">Savings balance: {money(row.balance)}</p>
          </li>)}</ol>
        </details>}
        <p className="text-[10px] leading-relaxed text-[var(--muted)]">Update your current savings balance manually as it changes. Contributions and selected coverage are plans, not completed bank transactions. Only selected coverage transfers change the main forecast.</p>
      </div>
    </aside>
  );
}
