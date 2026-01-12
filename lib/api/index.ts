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
          { name: "Gmail - Messages", description: "Gmail message operations" },
          { name: "Gmail - Labels", description: "Gmail label operations" },
          { name: "Gmail - Threads", description: "Gmail thread operations" },
          { name: "Gmail - Drafts", description: "Gmail draft operations" },
          { name: "Calendar - Calendars", description: "Google Calendar calendar list operations" },
          { name: "Calendar - Events", description: "Google Calendar event operations" },
          { name: "Calendar - Free/Busy", description: "Google Calendar free/busy operations" },
          { name: "Outlook - Messages", description: "Microsoft Outlook message operations" },
          { name: "Outlook - Folders", description: "Microsoft Outlook folder operations" },
          { name: "Outlook - Conversations", description: "Microsoft Outlook conversation operations" },
          { name: "Outlook - Drafts", description: "Microsoft Outlook draft operations" },
          { name: "Outlook Calendar - Calendars", description: "Microsoft Outlook calendar list operations" },
          { name: "Outlook Calendar - Events", description: "Microsoft Outlook event operations" },
          { name: "Outlook Calendar - Event Responses", description: "Microsoft Outlook event response operations" },
          { name: "Outlook Calendar - Schedule", description: "Microsoft Outlook free/busy operations" },
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
      },
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
