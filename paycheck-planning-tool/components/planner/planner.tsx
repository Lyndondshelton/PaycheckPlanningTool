"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/login/sign-out-button";
import { usePlanPersistence } from "@/components/planner/use-plan-persistence";
import { addDays, BILL_SCHEDULES, cents, createPlan, forecastPlan, forecastEndDate, INCOME_BASES,
  isDate, isMoney, PAY_SCHEDULES, paycheckAmount, planErrors, purchaseError, todayString,
  type Bill, type BillSchedule, type ForecastRange, type IncomeBasis, type PaySchedule, type Plan, type Purchase } from "@/lib/planner/planner";

import { formatDate, money } from "@/lib/formatting/format";
import { Field, Icon } from "@/components/planner/ui";
import { ForecastControls } from "@/components/planner/forecast-controls";
import { ForecastTimeline } from "@/components/planner/forecast-timeline";
import { EventBadge } from "@/components/planner/event-badge";
import { CollapsibleSection } from "@/components/planner/collapsible-section";
import { SavingsSection } from "@/components/planner/savings-section";

// Purchases have their own draft and edit state, independent of the recurring bill form.
function PurchasesSection({ purchases, onChange, onNotice }: {
  purchases: Purchase[];
  onChange: (purchases: Purchase[]) => void;
  onNotice: (notice: string) => void;
}) {
  const [draft, setDraft] = useState({ name: "", amount: "", date: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  // Sort a copy for display, leaving saved order and transaction IDs intact.
  const sortedPurchases = [...purchases].sort((a, b) => a.date.localeCompare(b.date));

  /**
   * Clears editing from forms.
   */
  function clearDraft() {
    setDraft({ name: "", amount: "", date: "" });
    setEditingId(null);
    setError("");
  }

  function savePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = purchaseError(draft);
    if (validationError) { setError(validationError); return; }
    // Match UNIQUE(user_id, purchase_name, purchase_date) before accepting the form.
    if (purchases.some(item => item.id !== editingId && item.name === draft.name.trim() && item.date === draft.date)) {
      setError("A purchase with this name already exists on this date."); return;
    }
    const purchase: Purchase = { ...draft, name: draft.name.trim(), id: editingId ?? crypto.randomUUID() };
    onChange(editingId ? purchases.map(item => item.id === editingId ? purchase : item) : [...purchases, purchase]);
    onNotice(`${purchase.name} ${editingId ? "updated" : "added"}.`);
    clearDraft();
    nameRef.current?.focus();
  }

  return (
    <CollapsibleSection headingId="purchases-heading"
                        title="One-time purchases"
                        count={purchases.length} number="03" kind="purchase"
                        description="Plan for an expense that happens just once."
                        transactions={purchases.length > 0 ? (
                          <ul className="bill-list purchase-list">
                            {sortedPurchases.map(purchase => (
                              <li key={purchase.id}>
                                <span className="bill-icon event-purchase"><Icon name="bill" size={18} /></span>
                                <div className="bill-detail">
                                  <strong>{purchase.name}</strong>
                                  <span>One-time · {isDate(purchase.date) ? formatDate(purchase.date, true) : "invalid date"}</span>
                                  <div className="bill-actions">
                                    <button aria-label={`Edit purchase ${purchase.name}`} onClick={() => {
                                      setEditingId(purchase.id); setDraft({ name: purchase.name, amount: purchase.amount, date: purchase.date });
                                      setError(""); nameRef.current?.focus();
                                    }}>Edit</button>
                                    <button aria-label={`Remove purchase ${purchase.name}`} onClick={() => {
                                      onChange(purchases.filter(item => item.id !== purchase.id));
                                      if (editingId === purchase.id) clearDraft();
                                      onNotice(`${purchase.name} removed.`);
                                    }}>Remove</button>
                                  </div>
                                </div>
                                <strong className="bill-amount">{isMoney(purchase.amount) ? money(cents(purchase.amount)) : "Invalid"}</strong>
                              </li>
                            ))}
                          </ul>
                        ) : <p className="px-4 pb-4 text-xs text-[var(--muted)] sm:px-6">No one-time purchases saved yet.</p>}>
      <form onSubmit={savePurchase} className="form-stack bill-form purchase-form">
        <h3>{editingId ? "Edit purchase" : "Add a one-time purchase"}</h3>
        <Field id="purchase-name" label="Purchase name">
          <input ref={nameRef} id="purchase-name" required maxLength={80} placeholder="e.g. Concert tickets or a new laptop" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field id="purchase-amount" label="Amount">
          <div className="money-input"><span aria-hidden="true">$</span><input id="purchase-amount" type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} /></div>
        </Field>
        <Field id="purchase-date" label="Purchase date" hint="Deducted once, on this date. Does not repeat.">
          <input id="purchase-date" type="date" min="1900-01-01" max="9998-12-31" required value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} aria-describedby="purchase-date-hint" />
        </Field>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="submit" className="button button-secondary"><Icon name={editingId ? "check" : "plus"} size={17} />{editingId ? "Save changes" : "Add purchase"}</button>
          {editingId && <button type="button" className="text-button" onClick={clearDraft}>Cancel</button>}
        </div>
      </form>
    </CollapsibleSection>
  );
}

export function Planner({ userId }: { userId: string }) {
  // Persistence lives outside the form component so editing and SQL concerns stay separate.
  const { plan, setPlan, ready, loadError, importNotice, status: storageStatus, problem,
    hasUnsavedChanges, retryLoad, retrySave } = usePlanPersistence(userId);
  const [billDraft, setBillDraft] = useState({ name: "", amount: "", dueDate: "", schedule: "monthly" as BillSchedule });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [billError, setBillError] = useState("");
  const [notice, setNotice] = useState("");
  const billNameRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof Plan>(key: K, value: Plan[K]) {
    setPlan(previous => ({ ...previous, [key]: value }));
  }
  function changeRange(horizon: ForecastRange) {
    setPlan(previous => ({
      ...previous, horizon,
      // Retain a custom date when switching presets; initialize it from the current window.
      targetDate: horizon === "custom" && !previous.targetDate ? forecastEndDate(previous) : previous.targetDate,
    }));
  }
  function changeCoverage(date: string, checked: boolean) {
    setPlan(previous => ({ ...previous, savingsCoverDates: checked
      ? [...new Set([...previous.savingsCoverDates, date])].sort()
      : previous.savingsCoverDates.filter(item => item !== date) }));
  }
  function clearBill() {
    setEditingId(null); setBillDraft({ name: "", amount: "", dueDate: "", schedule: "monthly" }); setBillError("");
  }
  function saveBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!billDraft.name.trim() || !isMoney(billDraft.amount) || cents(billDraft.amount) <= 0 || !isDate(billDraft.dueDate)) {
      setBillError("Enter a bill name, a positive amount with up to 2 decimals, and a valid due date."); return;
    }
    // Bill names are unique within an account, with case preserved.
    if (plan.bills.some(item => item.id !== editingId && item.name === billDraft.name.trim())) {
      setBillError("A bill with this name already exists. Edit that bill or choose another name."); return;
    }
    const bill: Bill = { ...billDraft, name: billDraft.name.trim(), id: editingId ?? crypto.randomUUID() };
    setPlan(previous => ({ ...previous, bills: editingId ? previous.bills.map(item => item.id === editingId ? bill : item) : [...previous.bills, bill] }));
    setNotice(`${bill.name} ${editingId ? "updated" : "added"}.`); clearBill(); billNameRef.current?.focus();
  }
  function loadExample() {
    const today = todayString();
    setPlan({ ...createPlan(today), savings: plan.savings, income: "1850", startingBalance: "650", nextPayday: addDays(today, 2), bills: [
      { id: "example-rent", name: "Rent", amount: "1200", dueDate: addDays(today, 5), schedule: "monthly" },
      { id: "example-internet", name: "Internet", amount: "65", dueDate: addDays(today, 8), schedule: "monthly" },
      { id: "example-insurance", name: "Car insurance", amount: "420", dueDate: addDays(today, 12), schedule: "semiannually" },
    ] });
    clearBill(); setNotice("Example plan loaded. Change any amount or date to explore.");
  }

  // ISO calendar dates sort chronologically, with the earliest due bills shown first.
  const sortedBills = [...plan.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const errors = planErrors(plan);
  const valid = ready && Object.keys(errors).length === 0;
  const projection = forecastPlan(plan);
  const rows = valid ? projection.cash : [];
  const opening = isMoney(plan.startingBalance, true) ? cents(plan.startingBalance) : 0;
  const ending = rows.length ? rows[rows.length - 1].balance : opening;
  // A start-date transfer resolves that day's opening deficit only to the extent actually covered.
  const riskOpening = projection.coverage[plan.startDate]?.transferred > 0
    ? Math.min(0, rows.find(row => row.date === plan.startDate)?.balance ?? opening) : opening;
  const lowest = Math.min(riskOpening, ...rows.map(row => row.balance));
  const savingsTransferred = projection.savings.reduce((sum, row) => sum + (row.withdrawal ?? 0), 0);
  const incomeTotal = rows.reduce((sum, row) => sum + row.income, 0);
  const expenseTotal = rows.reduce((sum, row) => sum + row.expenses, 0);
  const billPaymentCount = rows.reduce((sum, row) => sum + row.transactions.filter(item => item.kind === "bill").length, 0);
  const purchaseCount = rows.reduce((sum, row) => sum + row.transactions.filter(item => item.kind === "purchase").length, 0);
  const firstShortfall = riskOpening < 0 ? plan.startDate : rows.find(row => row.balance < 0)?.date;
  const endDate = forecastEndDate(plan);

  return <div className="app-shell">
    <header className="app-header"><Link href="/" className="brand"><span className="brand-mark"><Icon name="wallet" size={23} /></span>Paycheck<span className="brand-light"> / planner</span></Link><div className="flex items-center gap-6"><span className="header-note"><span className="status-dot" />A little clarity for what’s ahead</span><SignOutButton hasUnsavedChanges={hasUnsavedChanges} /></div></header>
    <main>
      <section className="page-intro"><div><p className="eyebrow">YOUR MONEY, WITH A PLAN</p><h1>See where your next<br className="desktop-break" /> paycheck takes you.</h1><p className="intro-copy">Bring your income and bills together. Know what’s coming in,<br className="desktop-break" /> what’s going out, and what you’ll have left.</p></div><div className="intro-aside"><Icon name="calendar" size={28} /><p>A clearer view.<br /><strong>One payday at a time.</strong></p></div></section>
      {!ready ? <div className="panel loading" role="status">{loadError ? <>
        <p>{loadError}</p><button type="button" className="text-button" onClick={retryLoad}>Retry loading</button>
        <Link href="/login" className="text-button">Sign in</Link>
      </> : "Opening your planner…"}</div> : <>
        <div className="workspace-heading flex-wrap gap-3">
          <span role="status" className="min-w-0 break-words"><span className="status-dot" />{storageStatus}</span>
          {problem?.kind === "conflict" ? <button type="button" className="text-button" onClick={() => window.location.reload()}>Reload saved plan</button>
            : problem && <button type="button" className="text-button" onClick={retrySave}>Retry saving</button>}
          {problem?.kind === "session" && <a href="/login" target="_blank" rel="noopener noreferrer" className="text-button">Sign in in a new tab</a>}
          {!plan.income && !plan.bills.length && !plan.purchases.length && <button className="text-button" onClick={loadExample}>Try an example <span aria-hidden="true">↗</span></button>}
        </div>
        {importNotice && <p className="mb-4 text-xs leading-relaxed text-[var(--muted)]" role="status">{importNotice}</p>}
        <div className="planner-layout"><aside className="setup-column">
          <section className="panel" aria-labelledby="income-heading"><div className="panel-heading"><span className="section-number event-income">01</span><div><h2 id="income-heading">Your income</h2><p>Set the rhythm of your paychecks.</p></div></div>
            <div className="form-stack">
              <div className="field-pair"><Field id="income" label="Income amount" error={plan.income ? errors.income : undefined} hint="USD · use take-home income"><div className="money-input"><span aria-hidden="true">$</span><input id="income" type="number" min="0" max="1000000000" step="0.01" placeholder="0.00" value={plan.income} onChange={event => update("income", event.target.value)} aria-invalid={!!plan.income && !!errors.income} aria-describedby="income-hint" /></div></Field>
                <Field id="income-basis" label="Amount is"><select id="income-basis" value={plan.incomeBasis} onChange={event => update("incomeBasis", event.target.value as IncomeBasis)}>{Object.entries(INCOME_BASES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
              <Field id="pay-schedule" label="Pay schedule"><select id="pay-schedule" value={plan.paySchedule} onChange={event => update("paySchedule", event.target.value as PaySchedule)}>{Object.entries(PAY_SCHEDULES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
              {plan.paySchedule === "semimonthly" && <div><div className="field-pair">{(["firstPayDay", "secondPayDay"] as const).map((key, index) => <Field key={key} id={key} label={`${index === 0 ? "First" : "Second"} day of month`}><input id={key} type="number" min="1" max="31" value={plan[key] || ""} onChange={event => update(key, Number(event.target.value))} aria-describedby="pay-days-hint" aria-invalid={!!errors.payDays} /></Field>)}</div><p id="pay-days-hint" className={errors.payDays ? "field-error" : "field-hint"}>{errors.payDays ?? "For the last day of each month, use 31."}</p></div>}
              <Field id="next-payday" label="Next payday" error={errors.nextPayday}><input id="next-payday" type="date" min="1900-01-01" max="9998-12-31" value={plan.nextPayday} onChange={event => update("nextPayday", event.target.value)} aria-invalid={!!errors.nextPayday} aria-describedby={errors.nextPayday ? "next-payday-hint" : undefined} /></Field>
              {!errors.income && <div className="paycheck-note"><Icon name="check" size={16} /><span><strong>{money(paycheckAmount(plan))}</strong> per paycheck</span></div>}
              {plan.incomeBasis !== "paycheck" && <p className="field-hint">Estimates use 52 weekly, 26 biweekly, 24 twice-monthly, or 12 monthly payments per year. Taxes aren’t deducted.</p>}
            </div>
          </section>
          <CollapsibleSection headingId="bills-heading" title="Recurring bills" count={plan.bills.length} number="02" kind="bill" description="Give each expense a place in your plan." transactions={
            plan.bills.length > 0 ? <ul className="bill-list">{sortedBills.map(bill => <li key={bill.id}><span className="bill-icon event-bill"><Icon name="bill" size={18} /></span><div className="bill-detail"><strong>{bill.name}</strong><span>{BILL_SCHEDULES[bill.schedule]} · from {isDate(bill.dueDate) ? formatDate(bill.dueDate, true) : "invalid date"}</span><div className="bill-actions"><button onClick={() => { setEditingId(bill.id); setBillDraft({ name: bill.name, amount: bill.amount, dueDate: bill.dueDate, schedule: bill.schedule }); setBillError(""); billNameRef.current?.focus(); }} aria-label={`Edit ${bill.name}`}>Edit</button><button onClick={() => { update("bills", plan.bills.filter(item => item.id !== bill.id)); if (editingId === bill.id) clearBill(); setNotice(`${bill.name} removed.`); }} aria-label={`Remove ${bill.name}`}>Remove</button></div></div><strong className="bill-amount">{isMoney(bill.amount) ? money(cents(bill.amount)) : "Invalid"}</strong></li>)}</ul> : <p className="px-4 pb-4 text-xs text-[var(--muted)] sm:px-6">No recurring bills saved yet.</p>
          }>
            <form onSubmit={saveBill} className="form-stack bill-form"><h3>{editingId ? "Edit bill" : "Add a recurring bill"}</h3>
              <Field id="bill-name" label="Bill name"><input ref={billNameRef} id="bill-name" required maxLength={80} placeholder="e.g. Rent or internet" value={billDraft.name} onChange={event => setBillDraft({ ...billDraft, name: event.target.value })} /></Field>
              <div className="field-pair"><Field id="bill-amount" label="Amount"><div className="money-input"><span aria-hidden="true">$</span><input id="bill-amount" type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" value={billDraft.amount} onChange={event => setBillDraft({ ...billDraft, amount: event.target.value })} /></div></Field><Field id="bill-schedule" label="Repeats"><select id="bill-schedule" value={billDraft.schedule} onChange={event => setBillDraft({ ...billDraft, schedule: event.target.value as BillSchedule })}>{Object.entries(BILL_SCHEDULES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
              <Field id="bill-date" label="Next due date" hint="Repeats from this date, including future years."><input id="bill-date" type="date" min="1900-01-01" max="9998-12-31" required value={billDraft.dueDate} onChange={event => setBillDraft({ ...billDraft, dueDate: event.target.value })} aria-describedby="bill-date-hint" /></Field>
              {billError && <p className="field-error" role="alert">{billError}</p>}
              <div className="button-row"><button type="submit" className="button button-secondary"><Icon name={editingId ? "check" : "plus"} size={17} />{editingId ? "Save changes" : "Add bill"}</button>{editingId && <button type="button" className="text-button" onClick={clearBill}>Cancel</button>}</div>
            </form>
          </CollapsibleSection>
          <PurchasesSection purchases={plan.purchases} onChange={purchases => update("purchases", purchases)} onNotice={setNotice} />
        </aside>
        <div className="grid min-w-0 grid-cols-1 items-start gap-5 min-[1400px]:grid-cols-[minmax(0,1fr)_280px]">
        <div className="forecast-column">
          <ForecastControls plan={plan} errors={errors} onChange={update} onRangeChange={changeRange} />
          {!valid ? <section className="panel empty-state"><span className="empty-icon"><Icon name="calendar" size={30} /></span><h2>Your next chapter starts here.</h2><p>{plan.income === "" ? "Enter your income to see your projected balance. Add bills and purchases to see what’s left after payday." : "Check the highlighted fields to calculate your forecast."}</p>{errors.bills && <p className="field-error">{errors.bills}</p>}{errors.purchases && <p className="field-error">{errors.purchases}</p>}{!plan.income && !plan.bills.length && !plan.purchases.length && <button className="button button-primary" onClick={loadExample}>Explore an example <Icon name="arrow" size={17} /></button>}</section> : <>
            <section className="summary-grid" aria-label="Forecast totals"><div className="summary-card ending-card"><span>Projected ending balance</span><strong className={ending < 0 ? "negative" : ""}>{money(ending)}</strong><small>On {formatDate(endDate, true)}</small></div><div className="summary-card"><span>Money coming in</span><strong className="positive">+{money(incomeTotal)}</strong><small>{rows.reduce((sum, row) => sum + row.transactions.filter(item => item.kind === "income").length, 0)} paychecks in this window</small></div><div className="summary-card"><span>Money going out</span><strong>{money(expenseTotal)}</strong><small>{billPaymentCount} bill payments · {purchaseCount} purchases</small></div></section>
            {firstShortfall && <div className="shortfall" role="status"><EventBadge kind="overdraft" /><strong>Your balance dips below zero on {formatDate(firstShortfall)}.</strong><span>Lowest projected balance: {money(lowest)}. Review the timing of your income and expenses.</span></div>}
            {savingsTransferred > 0 && <p className="rounded-lg border border-[#cfe4e7] bg-[#edf7f8] px-4 py-3 text-xs leading-relaxed text-[#1b747c]">{money(savingsTransferred)} in planned transfers from savings is included in these balances. Paycheck and spending totals stay separate.</p>}
            <ForecastTimeline rows={rows} plan={plan} lowest={lowest} coverage={projection.coverage} onCoverageChange={changeCoverage} />
          </>}
          <p className="forecast-note">A plan based on the income, bills, and purchases you enter. Dates stay as scheduled, including weekends. Recurring dates on the 29th–31st move to month end in shorter months. One-time purchases occur only on their selected date. Same-day transactions share one closing balance.</p>
        </div>
        <SavingsSection plan={plan} projection={projection} lowestCashBalance={valid ? lowest : null} onChange={savings => update("savings", savings)} onNotice={setNotice} />
        </div></div>
      </>}
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      <footer className="app-footer"><span>Make room for a little peace of mind.</span><span>USD · Your plan is stored only in this browser</span></footer>
    </main>
  </div>;
}
