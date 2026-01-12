import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

// Import providers - this triggers auto-registration
import "@/lib/providers";

// Import registry utilities for dynamic configuration
import {
  getAllOpenApiTags,
  getAllOpenApiTagGroups,
  getAllRoutes,
} from "@/lib/providers";

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

// Build the API with dynamic provider registration
function buildApi() {
  // Get tags and tag groups from all registered providers
  const tags = getAllOpenApiTags();
  const tagGroups = getAllOpenApiTagGroups();
  const routes = getAllRoutes();

  // Create base API with swagger
  let api = new Elysia({ prefix: "/api/v1" })
    .use(
      swagger({
        path: "/docs",
        documentation: {
          info: {
            title: "Workspace Connectors API",
            version: "1.0.0",
            description: API_DESCRIPTION,
          },
          tags,
          "x-tagGroups": tagGroups,
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
    );

  // Mount all provider routes dynamically
  for (const route of routes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api = api.use(route as any);
  }

  return api;
}

export const api = buildApi();

export type Api = typeof api;
