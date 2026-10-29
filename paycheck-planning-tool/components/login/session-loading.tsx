/** Request-time session reads sit inside Suspense when Cache Components is enabled. */
export function SessionLoading() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-sm text-[var(--muted)]" aria-busy="true">
      <p role="status">Checking your session...</p>
    </main>
  );
}
