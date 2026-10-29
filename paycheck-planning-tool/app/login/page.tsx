import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { LoginShell } from "@/components/login/login-shell";
import { SessionLoading } from "@/components/login/session-loading";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in | Paycheck Planner",
  description: "Sign in to Paycheck Planner.",
};

async function SignedOutLogin() {
  if (await getSession()) redirect("/");
  return (
    <LoginShell>
      <LoginForm />
    </LoginShell>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<SessionLoading />}><SignedOutLogin /></Suspense>;
}
