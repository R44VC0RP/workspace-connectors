import Link from "next/link";
import { IconExternalLink, IconArrowRight, IconBrandGithub } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { CodeExamples } from "@/components/code-examples";
import { InboundWordmark } from "@/components/inbound-wordmark";

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center">
      <main className="w-full max-w-4xl px-6 py-16">
        {/* Hero */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>by</span>
            <InboundWordmark />
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Workspace Connectors
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            A unified API for Google Workspace. Connect your Gmail and Calendar,
            generate scoped API keys, and integrate with any application.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href="/login">
                Get Started
                <IconArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/api/v1/docs" target="_blank">
                API Documentation
                <IconExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link
                href="https://github.com/R44VC0RP/workspace-connectors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconBrandGithub className="mr-2 h-4 w-4" />
                GitHub
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Start */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold tracking-tight">Quick Start</h2>
          <p className="mt-2 text-muted-foreground">
            Copy these examples to start using the API in your application.
          </p>
          <div className="mt-6">
            <CodeExamples showHeader={false} />
          </div>
        </div>
      </main>
    </div>
  );
}
