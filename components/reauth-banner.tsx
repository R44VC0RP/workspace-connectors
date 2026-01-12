"use client";

import { useQuery } from "convex/react";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

/**
 * Banner that shows when user needs to re-authenticate to get new OAuth scopes.
 * Displays when their stored scopes don't include the upgraded permissions.
 */
export function ReauthBanner() {
  const [dismissed, setDismissed] = useState(false);
  const needsReauth = useQuery(api.tokens.needsReauthentication);

  // Don't show if dismissed, still loading, or user doesn't need re-auth
  if (dismissed || needsReauth === undefined || !needsReauth) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    // The page will redirect to login after sign out
  };

  return (
    <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
      <IconAlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm text-amber-700 dark:text-amber-300">
          New features available! Please sign out and sign back in to enable 
          drafts, label management, and message organization.
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="border-amber-500/50 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          >
            Sign out to upgrade
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-500/20 rounded"
            aria-label="Dismiss"
          >
            <IconX className="h-4 w-4 text-amber-500" />
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
