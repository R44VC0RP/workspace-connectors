"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

import { authClient } from "@/lib/auth-client";
import { AutumnWrapper } from "./AutumnWrapper";

import type { PropsWithChildren } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
  initialToken,
}: PropsWithChildren<{ initialToken?: string | null }>) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      <AutumnWrapper>{children}</AutumnWrapper>
    </ConvexBetterAuthProvider>
  );
}
