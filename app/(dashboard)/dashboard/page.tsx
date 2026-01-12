"use client";

import Link from "next/link";
import {
  IconKey,
  IconLink,
  IconArrowRight,
  IconBook,
  IconExternalLink,
} from "@tabler/icons-react";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CodeExamples } from "@/components/code-examples";

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {session?.user.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <IconLink className="h-5 w-5" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              Link your Google and Microsoft accounts to access their APIs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/accounts">
                Manage Accounts
                <IconArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <IconKey className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Create scoped API keys to access your connected accounts
              programmatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/api-keys">
                Manage Keys
                <IconArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <IconBook className="h-5 w-5" />
              API Documentation
            </CardTitle>
            <CardDescription>
              Explore the full API reference with interactive examples.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/api/v1/docs" target="_blank">
                View Docs
                <IconExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Quick Start</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy these examples to start using the API.
        </p>
        <div className="mt-4">
          <CodeExamples showHeader={false} />
        </div>
        <div className="mt-4">
          <Button asChild>
            <Link href="/api/v1/docs" target="_blank">
              View Full API Documentation
              <IconExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
