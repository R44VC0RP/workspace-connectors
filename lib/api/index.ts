import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

import { googleMailRoutes } from "./routes/google/mail";
import { googleCalendarRoutes } from "./routes/google/calendar";

const API_DESCRIPTION = `
API for accessing connected Google Workspace services.

**Zero Data Retention** — Your data is never stored or logged by our servers. All requests are proxied directly to Google APIs.

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
          { name: "Gmail", description: "Gmail operations" },
          { name: "Calendar", description: "Google Calendar operations" },
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
  .use(googleCalendarRoutes);

export type Api = typeof api;
