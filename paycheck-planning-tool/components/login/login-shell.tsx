import Link from "next/link";
import type { ReactNode } from "react";

/** Shared page frame for account screens, separate from the planner workspace. */
export function LoginShell({ children, heading = "Welcome back.", title = "Sign in to your account", description = "Enter your email and password below." }: {
  children: ReactNode;
  heading?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8 lg:px-12">
      <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-5 sm:min-h-24">
        <Link href="/" aria-label="Paycheck Planner home" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--green)] text-white" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6" />
              <path d="M20 12h-5v4h5M17 14h.01" />
            </svg>
          </span>
          Paycheck <span className="font-normal text-[var(--muted)]">/ planner</span>
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--green)] hover:underline">
          Back to planner <span aria-hidden="true" className="ml-2">&rarr;</span>
        </Link>
      </header>

      <main className="grid flex-1 items-center gap-10 py-10 sm:py-16 lg:grid-cols-2 lg:gap-20" aria-labelledby="login-heading">
        <div className="max-w-md">
          <p className="mb-4 text-[10px] font-bold tracking-[0.18em] text-[var(--green)]">A LITTLE CLARITY FOR WHAT&apos;S AHEAD</p>
          <h1 id="login-heading" className="text-4xl font-medium tracking-tight sm:text-5xl">{heading}</h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[var(--muted)]">
            A clearer view of your paychecks, bills, and the days in between.
          </p>
          <div className="mt-7 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[#edf2e6] p-4 sm:mt-9 sm:p-5">
            <svg className="mt-0.5 shrink-0 text-[var(--green)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 11h18M9 16l2 2 4-4" />
            </svg>
            <div>
              <p className="text-sm font-semibold">Keep planning with confidence</p>
              <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                See what&apos;s coming in, what&apos;s going out, and where your savings can help.
              </p>
            </div>
          </div>
        </div>

        <section aria-labelledby="login-form-heading" className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8 lg:justify-self-end">
          <h2 id="login-form-heading" className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
          {children}
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-xs leading-6 text-[var(--muted)]">
        Paycheck Planner &middot; One transaction day at a time.
      </footer>
    </div>
  );
}
