"use client";

import { useQuery } from "convex/react";
import { IconCheck, IconPlus } from "@tabler/icons-react";

import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

// Available providers with their granted scopes
const PROVIDERS = [
  {
    id: "google" as const,
    name: "Google",
    icon: GoogleLogo,
    description: "Access Gmail and Google Calendar",
    scopes: [
      "Read emails",
      "Send emails",
      "Modify emails",
      "Manage labels",
      "Manage drafts",
      "Read calendar",
      "Manage events",
    ],
  },
  {
    id: "microsoft" as const,
    name: "Microsoft",
    icon: MicrosoftLogo,
    description: "Access Outlook and Microsoft Calendar",
    scopes: [
      "Read emails",
      "Send emails",
      "Modify emails",
      "Read calendar",
      "Manage events",
    ],
  },
];

export default function AccountsPage() {
  const { data: session } = useSession();
  const linkedAccounts = useQuery(api.tokens.getLinkedAccounts);

  const isLinked = (provider: "google" | "microsoft") => {
    return linkedAccounts?.some((acc) => acc.provider === provider) ?? false;
  };

  const handleLinkAccount = async (provider: "google" | "microsoft") => {
    await authClient.linkSocial({
      provider,
      callbackURL: "/dashboard/accounts",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connected Accounts</h1>
        <p className="mt-2 text-muted-foreground">
          Link your workspace accounts to access their APIs through Workspace Connectors.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const connected = isLinked(provider.id);
          const Icon = provider.icon;

          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </div>
                  </div>
                  {connected ? (
                    <Badge variant="secondary" className="gap-1 text-green-600">
                      <IconCheck className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Button onClick={() => handleLinkAccount(provider.id)}>
                      <IconPlus className="mr-2 h-4 w-4" />
                      Connect
                    </Button>
                  )}
                </div>
              </CardHeader>
              {connected && (
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Available permissions:</p>
                    <div className="flex flex-wrap gap-2">
                      {provider.scopes.map((scope) => (
                        <Badge key={scope} variant="outline">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    {provider.id === "google" && session?.user?.email && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Connected as {session.user.email}
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="font-medium">How it works</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>1. Connect your Google and/or Microsoft accounts above</li>
          <li>2. Create an API key with the permissions you need</li>
          <li>3. Use your API key to access the connected services via our unified API</li>
        </ul>
      </div>
    </div>
  );
}
