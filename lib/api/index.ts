import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

import { googleMailRoutes } from "./routes/google/mail";
import { googleCalendarRoutes } from "./routes/google/calendar";
import { microsoftMailRoutes } from "./routes/microsoft/mail";
import { microsoftCalendarRoutes } from "./routes/microsoft/calendar";

const API_DESCRIPTION = `
API for accessing connected Google Workspace and Microsoft 365 services.

**Zero Data Retention** — Your data is never stored or logged by our servers. All requests are proxied directly to Google and Microsoft APIs.

## Authentication

All API requests require an API key passed as a Bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer your_api_key
\`\`\`

## Rate Limits

API requests are limited to **100 requests per minute** per API key.

When you exceed the rate limit, you'll receive a \`429 Too Many Requests\` response.

## Error Responses

All errors return a consistent JSON format:

\`\`\`json
{
  "error": "error_code",
  "message": "Human readable message"
}
\`\`\`

| Status | Description |
|--------|-------------|
| 401 | Invalid or missing API key |
| 402 | Payment required (upgrade plan) |
| 403 | Insufficient permissions |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
`;

export const api = new Elysia({ prefix: "/api/v1" })
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Workspace Connectors API",
          version: "1.0.0",
          description: API_DESCRIPTION,
        },
        tags: [
          { name: "System", description: "Health and status endpoints" },
          // Google tags
          { name: "Google Mail - Messages", description: "Gmail message operations" },
          { name: "Google Mail - Labels", description: "Gmail label operations" },
          { name: "Google Mail - Threads", description: "Gmail thread operations" },
          { name: "Google Mail - Drafts", description: "Gmail draft operations" },
          { name: "Google Calendar - Calendars", description: "Google Calendar calendar list operations" },
          { name: "Google Calendar - Events", description: "Google Calendar event operations" },
          { name: "Google Calendar - Free/Busy", description: "Google Calendar free/busy operations" },
          // Microsoft tags
          { name: "Microsoft Mail - Messages", description: "Outlook message operations" },
          { name: "Microsoft Mail - Folders", description: "Outlook folder operations" },
          { name: "Microsoft Mail - Conversations", description: "Outlook conversation operations" },
          { name: "Microsoft Mail - Drafts", description: "Outlook draft operations" },
          { name: "Microsoft Calendar - Calendars", description: "Outlook calendar list operations" },
          { name: "Microsoft Calendar - Events", description: "Outlook event operations" },
          { name: "Microsoft Calendar - Event Responses", description: "Outlook event response operations" },
          { name: "Microsoft Calendar - Schedule", description: "Outlook free/busy operations" },
        ],
        // Tag groups for better organization in docs UI
        "x-tagGroups": [
          {
            name: "System",
            tags: ["System"],
          },
          {
            name: "Google",
            tags: [
              "Google Mail - Messages",
              "Google Mail - Labels",
              "Google Mail - Threads",
              "Google Mail - Drafts",
              "Google Calendar - Calendars",
              "Google Calendar - Events",
              "Google Calendar - Free/Busy",
            ],
          },
          {
            name: "Microsoft",
            tags: [
              "Microsoft Mail - Messages",
              "Microsoft Mail - Folders",
              "Microsoft Mail - Conversations",
              "Microsoft Mail - Drafts",
              "Microsoft Calendar - Calendars",
              "Microsoft Calendar - Events",
              "Microsoft Calendar - Event Responses",
              "Microsoft Calendar - Schedule",
            ],
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "API key as Bearer token",
            },
          },
        },
      } as Record<string, unknown>,
    })
  )
  // Health check (public)
  .get(
    "/health",
    () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
    {
      detail: {
        summary: "Health check",
        tags: ["System"],
      },
    }
  )
  // Mount Google routes
  .use(googleMailRoutes)
  .use(googleCalendarRoutes)
  // Mount Microsoft routes
  .use(microsoftMailRoutes)
  .use(microsoftCalendarRoutes);

export type Api = typeof api;
