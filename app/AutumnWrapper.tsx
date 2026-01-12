"use client";

import { AutumnProvider } from "autumn-js/react";
import { api } from "@/convex/_generated/api";
import { useConvex } from "convex/react";
import { useSession } from "@/lib/auth-client";

import type { PropsWithChildren } from "react";

export function AutumnWrapper({ children }: PropsWithChildren) {
  const convex = useConvex();
  const { data: session, isPending } = useSession();

  // Only wrap with AutumnProvider when user is authenticated
  // This prevents Autumn from trying to create customers for unauthenticated users
  if (isPending || !session) {
    return <>{children}</>;
  }

  return (
    <AutumnProvider convex={convex} convexApi={(api as unknown as { autumn: typeof api.auth }).autumn}>
      {children}
    </AutumnProvider>
  );
}
