"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";

/** Shared sign-in and registration fields; credentials go only to Better Auth. */
export function LoginForm({ mode = "signin" }: { mode?: "signin" | "signup" }) {
  const signingUp = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    if (signingUp && !name) {
      setError("Enter your name.");
      return;
    }
    if (signingUp && password !== form.get("confirm-password")) {
      setError("Your passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const result = signingUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        const code = String(result.error.code ?? "");
        if (code === "INVALID_EMAIL_OR_PASSWORD" || result.error.status === 401) {
          setError("The email or password is incorrect.");
        } else if (code.startsWith("USER_ALREADY_EXISTS")) {
          setError("An account with this email already exists. Please sign in.");
        } else if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
          setError("Choose a password between 8 and 128 characters.");
        } else if (result.error.status === 429) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError(signingUp ? "Could not create your account. Please try again." : "Could not sign in. Please try again.");
        }
        return;
      }
      // Reload the protected server page after the browser receives its session cookie.
      window.location.replace("/");
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="login-form-heading" aria-describedby="plan-storage-note" aria-busy={pending} className="mt-6 flex flex-col gap-5">
      <p id="plan-storage-note" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-xs leading-6 text-[var(--muted)]">
        Your plan saves to your account so you can open it on another device.
      </p>

      {signingUp && <div className="flex flex-col gap-2">
        <label htmlFor="signup-name" className="text-xs font-semibold">Your name</label>
        <input id="signup-name" name="name" type="text" autoComplete="name" required maxLength={100} disabled={pending} className="h-12 text-base" />
      </div>}

      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-xs font-semibold">Email address</label>
        <input id="login-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required disabled={pending} placeholder="you@example.com" className="h-12 text-base" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="login-password" className="text-xs font-semibold">Password</label>
        <div className="relative">
          <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete={signingUp ? "new-password" : "current-password"} required minLength={signingUp ? 8 : undefined} maxLength={signingUp ? 128 : undefined} disabled={pending} aria-describedby={signingUp ? "password-hint" : undefined} className="h-12 pr-20 text-base" />
          <button type="button" disabled={pending} aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword(previous => !previous)} className="absolute inset-y-0 right-1 my-1 min-w-16 rounded-md px-3 text-xs font-semibold text-[var(--green)] hover:bg-[var(--background)]">
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {signingUp && <p id="password-hint" className="text-xs leading-5 text-[var(--muted)]">Use between 8 and 128 characters.</p>}
      </div>

      {signingUp && <div className="flex flex-col gap-2">
        <label htmlFor="signup-confirm-password" className="text-xs font-semibold">Confirm password</label>
        <input id="signup-confirm-password" name="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} disabled={pending} className="h-12 text-base" />
      </div>}

      {error && <p id="login-error" role="alert" className="rounded-lg border border-[var(--border)] bg-[#fff2ed] px-3 py-3 text-xs leading-6 text-[var(--danger)]">{error}</p>}

      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--green)] px-5 py-3 text-sm font-semibold text-white hover:bg-[#194732] disabled:cursor-wait disabled:opacity-60">
        {pending ? (signingUp ? "Creating account..." : "Signing in...") : (signingUp ? "Create account" : "Sign in")}
      </button>

      <p className="text-center text-xs leading-6 text-[var(--muted)]">
        {signingUp ? "Already have an account? " : "New to Paycheck Planner? "}
        <Link href={signingUp ? "/login" : "/signup"} className="inline-flex min-h-11 items-center font-semibold text-[var(--green)] hover:underline">
          {signingUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
