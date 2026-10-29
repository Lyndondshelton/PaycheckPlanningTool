import "server-only";
import { getDb } from "./connection";
import { PlanRepository } from "./plan-repository";

// Keep the credential-bearing connection behind a server-only entry point.
export function getPlanRepository(): PlanRepository { return new PlanRepository(getDb()); }
