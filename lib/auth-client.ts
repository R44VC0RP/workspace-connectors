"use client";

import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "better-auth/client/plugins";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    convexClient(),
    apiKeyClient(),
  ],
});

// Export commonly used hooks and methods
export const { signIn, signOut, useSession, apiKey } = authClient;
