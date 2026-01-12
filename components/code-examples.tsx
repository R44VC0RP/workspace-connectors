"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconExternalLink, IconCopy, IconCheck } from "@tabler/icons-react";
import { codeToHtml } from "shiki";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Language = "node" | "python" | "curl";
type Endpoint = "mail" | "calendar";

const LANG_MAP: Record<Language, string> = {
  node: "typescript",
  python: "python",
  curl: "bash",
};

const CODE_EXAMPLES: Record<Endpoint, Record<Language, string>> = {
  mail: {
    curl: `curl -X GET "https://workspace.inboundemail.com/api/v1/google/mail/messages" \\
  -H "Authorization: Bearer your_api_key"`,
    node: `const response = await fetch(
  "https://workspace.inboundemail.com/api/v1/google/mail/messages",
  {
    headers: {
      Authorization: \`Bearer \${process.env.WORKCONN_API_KEY}\`,
    },
  }
);

const { messages } = await response.json();

// Example response:
// {
//   messages: [
//     { id: "18abc123", subject: "Hello", from: "sender@example.com" },
//   ]
// }`,
    python: `import os
import requests

response = requests.get(
    "https://workspace.inboundemail.com/api/v1/google/mail/messages",
    headers={
        "Authorization": f"Bearer {os.environ['WORKCONN_API_KEY']}",
    },
)

messages = response.json()["messages"]

# Example response:
# {
#   "messages": [
#     { "id": "18abc123", "subject": "Hello", "from": "sender@example.com" },
#   ]
# }`,
  },
  calendar: {
    curl: `curl -X GET "https://workspace.inboundemail.com/api/v1/google/calendar/events" \\
  -H "Authorization: Bearer your_api_key"`,
    node: `const response = await fetch(
  "https://workspace.inboundemail.com/api/v1/google/calendar/events",
  {
    headers: {
      Authorization: \`Bearer \${process.env.WORKCONN_API_KEY}\`,
    },
  }
);

const { events } = await response.json();

// Example response:
// {
//   events: [
//     { id: "evt123", summary: "Team Meeting", start: "2024-01-15T10:00:00Z" },
//   ]
// }`,
    python: `import os
import requests

response = requests.get(
    "https://workspace.inboundemail.com/api/v1/google/calendar/events",
    headers={
        "Authorization": f"Bearer {os.environ['WORKCONN_API_KEY']}",
    },
)

events = response.json()["events"]

# Example response:
# {
#   "events": [
#     { "id": "evt123", "summary": "Team Meeting", "start": "2024-01-15T10:00:00Z" },
#   ]
# }`,
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 hover:bg-zinc-800"
      onClick={handleCopy}
    >
      {copied ? (
        <IconCheck className="h-4 w-4 text-green-500" />
      ) : (
        <IconCopy className="h-4 w-4 text-zinc-400" />
      )}
    </Button>
  );
}

function CodeBlock({ code, language }: { code: string; language: Language }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    codeToHtml(code, {
      lang: LANG_MAP[language],
      theme: "monokai",
    }).then(setHtml);
  }, [code, language]);

  const lines = code.split("\n");

  return (
    <div className="relative rounded-lg bg-[#272822] overflow-hidden">
      <div className="absolute right-2 top-2 z-10">
        <CopyButton text={code} />
      </div>
      <div className="flex overflow-x-auto">
        {/* Line numbers */}
        <div className="flex-none select-none py-4 pl-4 pr-2 text-right text-sm leading-6 text-zinc-500 border-r border-zinc-700">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code content */}
        <div
          className="flex-1 py-4 pl-4 pr-12 text-sm leading-6 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

interface CodeExamplesProps {
  showHeader?: boolean;
}

export function CodeExamples({ showHeader = true }: CodeExamplesProps) {
  const [endpoint, setEndpoint] = useState<Endpoint>("mail");
  const [language, setLanguage] = useState<Language>("node");

  const currentCode = CODE_EXAMPLES[endpoint][language];

  return (
    <div className="space-y-4">
      {/* Endpoint selector */}
      <Tabs value={endpoint} onValueChange={(v) => setEndpoint(v as Endpoint)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mail">Gmail</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Language selector */}
      <Tabs value={language} onValueChange={(v) => setLanguage(v as Language)}>
        <TabsList>
          <TabsTrigger value="node">Node.js</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
          <TabsTrigger value="curl">cURL</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Code block with syntax highlighting */}
      <CodeBlock code={currentCode} language={language} />

      {/* Rate limits info */}
      <p className="text-sm text-muted-foreground">
        Rate limit: <span className="font-mono text-foreground">100 requests/minute</span> per API key
      </p>

      {showHeader && (
        <Button asChild>
          <Link href="/api/v1/docs" target="_blank">
            View Full API Documentation
            <IconExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
