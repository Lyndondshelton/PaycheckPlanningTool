import { useId } from "react";
import type { CoverageDay } from "@/lib/planner/planner";
import { formatDate, money } from "@/lib/formatting/format";

type Props = {
  date: string;
  balance: number;
  selected: boolean;
  coverage: CoverageDay | undefined;
  onChange: (date: string, checked: boolean) => void;
};

// Both responsive placements share the same saved selection, with unique description IDs.
export function SavingsCoverageControl({ date, balance, selected, coverage, onChange }: Props) {
  const noteId = useId();
  return (
    <div className="mt-3 rounded-md border border-[#dde5db] bg-white p-1 whitespace-normal text-left">
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
        <input type="checkbox" aria-label={`cover with savings on ${formatDate(date, true)}`} aria-describedby={noteId}
          checked={selected} disabled={coverage?.available === null && !selected}
          onChange={event => onChange(date, event.target.checked)}
          style={{ width: 16, minWidth: 16, height: 16, padding: 0, marginTop: 2, flexShrink: 0, accentColor: "var(--green)" }} />
        <span>cover</span>
      </label>
      <p id={noteId} className={`mt-1.5 break-words text-[11px] leading-relaxed ${balance < 0 && selected ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
        {coverage?.available === null ? "Fix savings details to calculate coverage."
          : selected
            ? (coverage?.beforeCoverage ?? 0) >= 0 ? "No transfer needed."
              : `${money(coverage?.transferred ?? 0)} from savings.${balance < 0 ? ` ${money(-balance)} still uncovered—action needed.` : " Overdraft covered."}`
            : `${money(coverage?.available ?? 0)} projected savings available.`}
      </p>
    </div>
  );
}
