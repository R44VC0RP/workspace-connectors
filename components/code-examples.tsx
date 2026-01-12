"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconExternalLink, IconCopy, IconCheck } from "@tabler/icons-react";
import { codeToHtml } from "shiki";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Language = "node" | "python" | "curl";
type Provider = "google" | "microsoft";
type Service = "mail" | "calendar";

const LANG_MAP: Record<Language, string> = {
  node: "typescript",
  python: "python",
  curl: "bash",
};

const CODE_EXAMPLES: Record<Provider, Record<Service, Record<Language, string>>> = {
  google: {
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
//     { id: "evt123", summary: "Team Meeting", start: { dateTime: "2024-01-15T10:00:00Z" } },
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
#     { "id": "evt123", "summary": "Team Meeting", "start": { "dateTime": "2024-01-15T10:00:00Z" } },
#   ]
# }`,
    },
  },
  microsoft: {
    mail: {
      curl: `curl -X GET "https://workspace.inboundemail.com/api/v1/microsoft/mail/messages" \\
  -H "Authorization: Bearer your_api_key"`,
      node: `const response = await fetch(
  "https://workspace.inboundemail.com/api/v1/microsoft/mail/messages",
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
//     { id: "AAMk...", subject: "Hello", from: "sender@example.com", isRead: true },
//   ]
// }`,
      python: `import os
import requests

response = requests.get(
    "https://workspace.inboundemail.com/api/v1/microsoft/mail/messages",
    headers={
        "Authorization": f"Bearer {os.environ['WORKCONN_API_KEY']}",
    },
)

messages = response.json()["messages"]

# Example response:
# {
#   "messages": [
#     { "id": "AAMk...", "subject": "Hello", "from": "sender@example.com", "isRead": true },
#   ]
# }`,
    },
    calendar: {
      curl: `curl -X GET "https://workspace.inboundemail.com/api/v1/microsoft/calendar/events" \\
  -H "Authorization: Bearer your_api_key"`,
      node: `const response = await fetch(
  "https://workspace.inboundemail.com/api/v1/microsoft/calendar/events",
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
//     { id: "AAMk...", summary: "Team Meeting", start: { dateTime: "2024-01-15T10:00:00", timeZone: "UTC" } },
//   ]
// }`,
      python: `import os
import requests

response = requests.get(
    "https://workspace.inboundemail.com/api/v1/microsoft/calendar/events",
    headers={
        "Authorization": f"Bearer {os.environ['WORKCONN_API_KEY']}",
    },
)

events = response.json()["events"]

# Example response:
# {
#   "events": [
#     { "id": "AAMk...", "summary": "Team Meeting", "start": { "dateTime": "2024-01-15T10:00:00", "timeZone": "UTC" } },
#   ]
# }`,
    },
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
  const [provider, setProvider] = useState<Provider>("google");
  const [service, setService] = useState<Service>("mail");
  const [language, setLanguage] = useState<Language>("node");

  const currentCode = CODE_EXAMPLES[provider][service][language];

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <Tabs value={provider} onValueChange={(v) => setProvider(v as Provider)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="google" className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </TabsTrigger>
          <TabsTrigger value="microsoft" className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Microsoft
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Service selector */}
      <Tabs value={service} onValueChange={(v) => setService(v as Service)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mail">{provider === "google" ? "Gmail" : "Outlook"}</TabsTrigger>
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
