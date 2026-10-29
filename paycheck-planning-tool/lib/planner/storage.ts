const LEGACY_PLAN_KEY = "paycheck-planner:v1";
const LEGACY_OWNER_KEY = "paycheck-planner:legacy-owner";

type PlanStorage = Pick<Storage, "getItem" | "setItem">;

/** Locate the legacy browser backup for import, scoped to user ID rather than email. */
export function planStorageKey(userId: string): string {
  if (!userId) throw new Error("A user ID is required to access a saved plan.");
  return `${LEGACY_PLAN_KEY}:${userId}`;
}

/**
 * The first account on this browser claims the pre-login plan. Keep the original
 * as a backup; an ownership marker prevents later accounts from importing it.
 * Write failures propagate so the UI can report that the backup could not be accessed.
 */
export function readUserPlan(storage: PlanStorage, userId: string): string | null {
  const key = planStorageKey(userId);
  const existing = storage.getItem(key);
  if (existing !== null) return existing;

  const legacy = storage.getItem(LEGACY_PLAN_KEY);
  const owner = storage.getItem(LEGACY_OWNER_KEY);
  if (legacy === null || (owner !== null && owner !== userId)) return null;

  storage.setItem(LEGACY_OWNER_KEY, userId);
  storage.setItem(key, legacy);
  return legacy;
}
