import type { ReactNode } from "react";

export function Icon({ name, size = 20 }: {
  name: "wallet" | "arrow" | "plus" | "check" | "calendar" | "bill"; size?: number;
}) {
  const paths = {
    wallet: <><path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6" /><path d="M20 12h-5v4h5M17 14h.01" /></>,
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" /></>,
    bill: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Field({ label, id, error, hint, children }: {
  label: string; id: string; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="field-error" id={`${id}-hint`}>{error}</span>
        : hint ? <span className="field-hint" id={`${id}-hint`}>{hint}</span> : null}
    </div>
  );
}
