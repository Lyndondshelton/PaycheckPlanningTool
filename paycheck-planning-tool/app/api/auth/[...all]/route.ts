import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

// Better Auth handles credentials, session cookies, validation, and sign-out.
export const { GET, POST } = toNextJsHandler(auth);
