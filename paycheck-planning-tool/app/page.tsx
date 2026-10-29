import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Planner } from "@/components/planner/planner";
import { SessionLoading } from "@/components/login/session-loading";
import { getSession } from "@/lib/auth/session";

async function ProtectedPlanner() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Planner key={session.user.id} userId={session.user.id} />;
}

export default function Home() {
  return (
    <Suspense fallback={<SessionLoading />}>
      <ProtectedPlanner />
    </Suspense>
  );
}
