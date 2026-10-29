import test from "node:test";
import assert from "node:assert/strict";
import { planStorageKey, readUserPlan } from "../lib/planner/storage.ts";

function storage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("accounts on the same browser load only their own saved plans", () => {
  const saved = storage([[planStorageKey("alice"), "alice-plan"], [planStorageKey("bob"), "bob-plan"]]);
  assert.equal(readUserPlan(saved, "alice"), "alice-plan");
  assert.equal(readUserPlan(saved, "bob"), "bob-plan");
  assert.equal(readUserPlan(saved, "carol"), null);
});

test("the first account claims the pre-login plan while preserving the original", () => {
  const legacy = '{"income":"100","bills":[]}';
  const saved = storage([["paycheck-planner:v1", legacy]]);
  assert.equal(readUserPlan(saved, "alice"), legacy);
  assert.equal(saved.getItem(planStorageKey("alice")), legacy);
  assert.equal(saved.getItem("paycheck-planner:v1"), legacy);
  assert.equal(readUserPlan(saved, "bob"), null);
});

test("an account's newer plan takes priority over the pre-login backup", () => {
  const saved = storage([["paycheck-planner:v1", "old-plan"], ["paycheck-planner:legacy-owner", "alice"], [planStorageKey("alice"), "updated-plan"]]);
  assert.equal(readUserPlan(saved, "alice"), "updated-plan");
  assert.equal(readUserPlan(saved, "bob"), null);
});

test("a failed migration can be retried only by its original owner", () => {
  const saved = storage([["paycheck-planner:v1", "original"]]);
  const write = saved.setItem;
  saved.setItem = (key, value) => {
    if (key === planStorageKey("alice")) throw new Error("Storage full");
    write(key, value);
  };
  assert.throws(() => readUserPlan(saved, "alice"), /Storage full/);
  assert.equal(saved.getItem("paycheck-planner:v1"), "original");
  assert.equal(readUserPlan(saved, "bob"), null);
  saved.setItem = write;
  assert.equal(readUserPlan(saved, "alice"), "original");
});

test("a failed ownership write prevents importing the shared legacy plan", () => {
  const saved = storage([["paycheck-planner:v1", "original"]]);
  saved.setItem = () => { throw new Error("Storage blocked"); };
  assert.throws(() => readUserPlan(saved, "alice"), /Storage blocked/);
  assert.equal(saved.getItem(planStorageKey("alice")), null);
});

test("saved plans require a nonempty authenticated user ID", () => {
  assert.throws(() => planStorageKey(""), /user ID/);
  assert.throws(() => readUserPlan(storage(), ""), /user ID/);
});
