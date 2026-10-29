import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";

/** Validate the request's session on the server; share the result within a render. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
