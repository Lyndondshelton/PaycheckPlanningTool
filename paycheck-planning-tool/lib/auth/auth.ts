import { betterAuth } from "better-auth";
import { getDb } from "@/lib/db/connection";

// The built-in Postgres adapter uses the existing connection pool and migrated schema.
export const auth = betterAuth({
  database: getDb(),
  emailAndPassword: {
    enabled: true,
  },
});
