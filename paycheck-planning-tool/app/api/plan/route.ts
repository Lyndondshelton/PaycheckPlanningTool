import { getSession } from "@/lib/auth/session";
import { getPlanRepository } from "@/lib/db/plan-store";
import { PlanConflictError } from "@/lib/db/plan-repository";
import { PlanValidationError } from "@/lib/planner/persistence";

// export const runtime = "nodejs";

// Financial data must not be cached by a browser or shared intermediary.
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function failure(error: unknown) {
  if (error instanceof PlanConflictError) return json({ error: error.message }, 409);
  if (error instanceof PlanValidationError) return json({ error: error.message }, 422);
  // Do not send SQL, connection strings, or financial data to logs or clients.
  console.error("A planner database operation failed.");
  return json({ error: "The database is unavailable. Keep this tab open and try again." }, 503);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return json({ error: "Sign in to load your plan." }, 401);
    return json({ ...await getPlanRepository().load(session.user.id), accountId: session.user.id });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  // Cookie authentication also requires protection against cross-origin writes.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Save requests must come from this application." }, 403);
  }
  try {
    const session = await getSession();
    if (!session) return json({ error: "Your session expired. Sign in again, then retry saving." }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Send a valid JSON plan." }, 400); }
    // A different account signing in elsewhere must not receive this tab's unsaved plan.
    if (body?.accountId !== session.user.id) return json({ error: "The signed-in account changed. Sign back into this plan's account before retrying." }, 401);
    if (!body || typeof body !== "object" || !(body.version === null
      || (typeof body.version === "string" && /^[a-f0-9]{64}$/.test(body.version)))) {
      return json({ error: "A valid saved-plan version is required." }, 400);
    }
    // The caller cannot choose an owner: the session supplies user_id for every query.
    return json(await getPlanRepository().save(session.user.id, body.plan, body.version));
  } catch (error) { return failure(error); }
}
