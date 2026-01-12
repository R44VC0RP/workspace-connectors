"use client";

import { IconCheck } from "@tabler/icons-react";

import { GoogleIcon } from "@/components/icons/google";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Available providers with their granted scopes
const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    icon: GoogleIcon,
    description: "Access Gmail and Google Calendar",
    scopes: [
      "Read emails",
      "Send emails",
      "Read calendar events",
      "Manage calendar events",
    ],
  },
];

export default function AccountsPage() {
  const { data: session } = useSession();

  // For now, we check if the user signed in with Google
  // In the future, we'd check linked accounts from Better Auth
  const isGoogleConnected = session?.user?.email?.includes("@");

  const handleConnectGoogle = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: "/dashboard/accounts",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connected Accounts</h1>
        <p className="mt-2 text-muted-foreground">
          Link your accounts to access their APIs through Workspace Connectors.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const isConnected = provider.id === "google" && isGoogleConnected;

          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <provider.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge variant="secondary" className="gap-1">
                      <IconCheck className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Button onClick={handleConnectGoogle}>Connect</Button>
                  )}
                </div>
              </CardHeader>
              {isConnected && (
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Granted permissions:</p>
                    <div className="flex flex-wrap gap-2">
                      {provider.scopes.map((scope) => (
                        <Badge key={scope} variant="outline">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Connected as {session?.user?.email}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            Microsoft and other providers coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
