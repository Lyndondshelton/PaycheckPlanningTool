"use client";

import { useEffect, useRef, useState } from "react";
import { createPlan, restorePlan, todayString, type Plan } from "@/lib/planner/planner";
import { planSaveError, type PlanSnapshot } from "@/lib/planner/persistence";
import { readUserPlan } from "@/lib/planner/storage";

type SaveProblem = { message: string; kind: "retry" | "session" | "conflict" };

/** Load cloud data first; import browser data only for an empty account. Serialize debounced saves. */
export function usePlanPersistence(userId: string) {
  const [plan, setPlan] = useState<Plan>(() => createPlan(""));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [importNotice, setImportNotice] = useState("");
  const version = useRef<string | null>(null);
  const inFlight = useRef(false);
  const serialized = JSON.stringify(plan);
  const dirty = ready && serialized !== baseline;
  const validationError = ready ? planSaveError(plan) : undefined;

  // Effects synchronize with the API and optional browser import, rather than deriving form state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    async function load() {
      try {
        const response = await fetch("/api/plan", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(result.error || "Your plan could not be loaded.");
        if (result.accountId !== userId) throw new Error("The signed-in account changed. Reload this page to open that account's plan.");
        const saved = result as PlanSnapshot;
        let restored = saved.plan ?? createPlan(todayString());
        // No empty/default plan is written until the user supplies valid income settings.
        setBaseline(JSON.stringify(restored));
        version.current = saved.version;
        if (!saved.plan) {
          try {
            const raw = readUserPlan(localStorage, userId);
            if (raw) {
              const legacy = restorePlan(JSON.parse(raw));
              if (legacy) {
                restored = legacy;
                setImportNotice("Your browser plan was loaded for import. Its browser backup is retained; check the save status above.");
              } else setImportNotice("The browser backup could not be read. It has been preserved.");
            }
          } catch { setImportNotice("The browser backup could not be accessed. It has been preserved."); }
        }
        setPlan(restored);
        setReady(true);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Your plan could not be loaded.");
      }
    }
    void load();
    return () => controller.abort();
  }, [userId, loadAttempt]);

  useEffect(() => {
    if (!ready || !dirty || validationError || problem || saving || inFlight.current) return;
    const timer = window.setTimeout(async () => {
      inFlight.current = true;
      setSaving(true);
      try {
        // Never abort a write on keystrokes: it may already have committed in Postgres.
        const response = await fetch("/api/plan", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, version: version.current, accountId: userId }),
        });
        const result = await response.json();
        if (!response.ok) {
          setProblem({ message: result.error || "Changes could not be saved. Keep this tab open.",
            kind: response.status === 409 ? "conflict" : response.status === 401 ? "session" : "retry" });
          return;
        }
        version.current = (result as PlanSnapshot).version;
        // Only mark the submitted values saved; edits made during the request remain dirty.
        setBaseline(serialized);
      } catch {
        setProblem({ message: "Changes could not be saved. Check your connection, keep this tab open, and retry.", kind: "retry" });
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [plan, serialized, ready, dirty, validationError, problem, saving, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Incomplete values and failed writes stay in memory; warn before closing or reloading them.
  useEffect(() => {
    if (!dirty && !saving) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const status = problem?.message ?? (saving ? "Saving to your account…"
    : validationError ? `Not saved: ${validationError}`
    : dirty ? "Changes waiting to save…" : "Saved to your account");

  return { plan, setPlan, ready, loadError, importNotice, status, problem, hasUnsavedChanges: dirty || saving,
    retryLoad: () => setLoadAttempt(value => value + 1), retrySave: () => setProblem(null) };
}
