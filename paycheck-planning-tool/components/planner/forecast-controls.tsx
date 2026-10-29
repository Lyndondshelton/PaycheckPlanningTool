import { addDays, forecastDays, HORIZONS, isDate, MAX_FORECAST_DAYS, type ForecastRange, type Plan } from "@/lib/planner/planner";
import { Field } from "./ui";

type Props = {
  plan: Plan;
  errors: Record<string, string>;
  onChange: <K extends keyof Plan>(key: K, value: Plan[K]) => void;
  onRangeChange: (range: ForecastRange) => void;
};

export function ForecastControls({ plan, errors, onChange, onRangeChange }: Props) {
  const maxTarget = isDate(plan.startDate) ? addDays(plan.startDate, MAX_FORECAST_DAYS - 1) : "9998-12-31";
  const customDays = forecastDays(plan);

  return (
    <section className="panel forecast-controls" aria-labelledby="forecast-heading">
      <div className="forecast-title">
        <div><p className="eyebrow">THE ROAD AHEAD</p><h2 id="forecast-heading">Your forecast</h2></div>
        <span className="live-label"><span className="status-dot" />Updates as you plan</span>
      </div>
      <div className="field-pair">
        <Field id="starting-balance" label="Starting balance" error={errors.startingBalance} hint="Before any transactions on the start date">
          <div className="money-input"><span aria-hidden="true">$</span><input id="starting-balance" type="number" min="-1000000000" max="1000000000" step="0.01" value={plan.startingBalance} onChange={event => onChange("startingBalance", event.target.value)} aria-describedby="starting-balance-hint" aria-invalid={!!errors.startingBalance} /></div>
        </Field>
        <Field id="start-date" label="Forecast starts" error={errors.startDate}>
          <input id="start-date" type="date" min="1900-01-01" max="9998-12-31" value={plan.startDate} onChange={event => onChange("startDate", event.target.value)} aria-invalid={!!errors.startDate} aria-describedby={errors.startDate ? "start-date-hint" : undefined} />
        </Field>
      </div>
      <fieldset className="range-field">
        <legend>Look ahead</legend>
        <div className="range-options">
          {HORIZONS.map(days => (
            <button key={days} type="button" aria-pressed={plan.horizon === days} className={plan.horizon === days ? "selected" : ""} onClick={() => onRangeChange(days)}>{days} <span>days</span></button>
          ))}
          <button type="button" aria-pressed={plan.horizon === "custom"} className={plan.horizon === "custom" ? "selected" : ""} onClick={() => onRangeChange("custom")} aria-controls="custom-target">Custom</button>
        </div>
        {errors.horizon && <p className="field-error">{errors.horizon}</p>}
      </fieldset>
      {plan.horizon === "custom" && (
        <div id="custom-target" className="custom-target">
          <Field id="target-date" label="Look ahead until" error={errors.targetDate} hint={`Includes this date. Up to ${MAX_FORECAST_DAYS.toLocaleString("en-US")} days from the start.`}>
            <input id="target-date" type="date" min={isDate(plan.startDate) ? plan.startDate : "1900-01-01"} max={maxTarget < "9998-12-31" ? maxTarget : "9998-12-31"} value={plan.targetDate} onChange={event => onChange("targetDate", event.target.value)} aria-invalid={!!errors.targetDate} aria-describedby="target-date-hint" />
          </Field>
          {!errors.targetDate && !errors.startDate && <p className="field-hint">{customDays} {customDays === 1 ? "day" : "days"}, including the start and target dates.</p>}
        </div>
      )}
    </section>
  );
}
