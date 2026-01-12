"use client";

import { useQuery } from "convex/react";
import { IconPlus, IconCheck } from "@tabler/icons-react";

import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Colored Google "G" logo
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Colored Microsoft logo (four squares)
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

const PROVIDERS = [
  {
    id: "google" as const,
    name: "Google",
    description: "Access Gmail and Google Calendar",
    icon: GoogleLogo,
  },
  {
    id: "microsoft" as const,
    name: "Microsoft",
    description: "Access Outlook and Microsoft Calendar",
    icon: MicrosoftLogo,
  },
];

export function LinkedAccounts() {
  const linkedAccounts = useQuery(api.tokens.getLinkedAccounts);

  const handleLinkAccount = async (provider: "google" | "microsoft") => {
    await authClient.linkSocial({
      provider,
      callbackURL: window.location.pathname,
    });
  };

  const isLinked = (provider: "google" | "microsoft") => {
    return linkedAccounts?.some((acc) => acc.provider === provider) ?? false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Accounts</CardTitle>
        <CardDescription>
          Connect your workspace accounts to access their APIs through your API keys.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PROVIDERS.map((provider) => {
          const linked = isLinked(provider.id);
          const Icon = provider.icon;

          return (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {provider.description}
                  </p>
                </div>
              </div>
              {linked ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <IconCheck className="h-4 w-4" />
                  Connected
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLinkAccount(provider.id)}
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
