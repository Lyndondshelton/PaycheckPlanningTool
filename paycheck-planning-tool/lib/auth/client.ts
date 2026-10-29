"use client";

import { createAuthClient } from "better-auth/react";

// Relative requests use this app's origin in development and after deployment.
export const authClient = createAuthClient();
