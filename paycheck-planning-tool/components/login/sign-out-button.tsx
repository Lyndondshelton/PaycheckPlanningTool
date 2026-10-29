"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton({ hasUnsavedChanges = false }: { hasUnsavedChanges?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (pending) return;
    // Ask before invalidating the session, while the user can still keep editing or retry saving.
    if (hasUnsavedChanges && !window.confirm("Your latest changes have not been saved. Sign out and discard those changes?")) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Could not sign out. Please try again.");
        return;
      }
      // A full navigation discards the in-memory plan and cached authenticated UI.
      window.location.replace("/login");
    } catch {
      setError("Could not connect. Please try signing out again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={signOut} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-[var(--green)] hover:underline disabled:cursor-wait disabled:opacity-60">
        {pending ? "Signing out..." : "Sign out"}
      </button>
      {error && <p role="alert" className="absolute right-0 top-full z-10 w-56 rounded-lg border border-[var(--border)] bg-white p-3 text-xs leading-5 text-[var(--danger)] shadow-sm">{error}</p>}
    </div>
  );
}
