import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { LoginShell } from "@/components/login/login-shell";
import { SessionLoading } from "@/components/login/session-loading";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create an account | Paycheck Planner",
  description: "Create your Paycheck Planner account.",
};

async function SignedOutSignup() {
  if (await getSession()) redirect("/");
  return (
    <LoginShell heading="Make room for a plan." title="Create your account" description="Start with your name, email, and a password.">
      <LoginForm mode="signup" />
    </LoginShell>
  );
}

export default function SignupPage() {
  return <Suspense fallback={<SessionLoading />}><SignedOutSignup /></Suspense>;
}
