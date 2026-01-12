# Provider Template

This template provides the scaffolding for adding a new provider to Workspace Connectors.

## Quick Start

### 1. Copy the Template

```bash
# Replace "slack" with your provider ID (lowercase)
cp -r lib/providers/_template lib/providers/slack
cd lib/providers/slack
mv config.ts.template config.ts
mv index.ts.template index.ts
```

### 2. Replace Placeholders

In both files, replace these placeholders:

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `{{provider_id}}` | `slack` | Lowercase ID used in code |
| `{{PROVIDER_UPPER}}` | `SLACK` | Uppercase for env vars |
| `{{PROVIDER_NAME}}` | `Slack` | Display name |
| `{{ProviderName}}` | `Slack` | PascalCase for types |

### 3. Set Up OAuth

In `config.ts`:
1. Add your OAuth scopes
2. Configure token/auth endpoints
3. Set any additional OAuth parameters

### 4. Define Permissions

In `config.ts`:
1. Add permission definitions (e.g., `"messages:read"`)
2. Create permission groups for common bundles
3. Map OAuth scopes to permissions

### 5. Create Services

Create service modules in `lib/services/{{provider_id}}/`:

```typescript
// lib/services/slack/messages.ts
export async function listMessages(accessToken: string, options: ListOptions) {
  // API implementation
}
```

### 6. Create Routes

Create Elysia routes in `lib/api/routes/{{provider_id}}/`:

```typescript
// lib/api/routes/slack/messages.ts
import { Elysia, t } from "elysia";
import { listMessages } from "@/lib/services/slack/messages";

export const slackMessagesRoutes = new Elysia({ prefix: "/slack/messages" })
  .get("/", async () => {
    // Route implementation
  });
```

### 7. Wire Everything Up

In `index.ts`:
1. Import your services and routes
2. Add them to the provider config

### 8. Register the Provider

Add to `lib/providers/index.ts`:

```typescript
import "./slack";
```

### 9. Add Token Management (Convex)

Add to `convex/tokens.ts`:
- `get{{Provider}}Tokens` query
- `update{{Provider}}Tokens` mutation
- `refresh{{Provider}}Tokens` action

Add HTTP endpoint in `convex/http.ts`:
- `/api/tokens/{{provider_id}}`

### 10. Update Auth Config

Add to `convex/auth.ts`:
- Add to `socialProviders`
- Add to `trustedProviders` for account linking

## File Structure

After setup, your provider should have:

```
lib/
├── providers/
│   └── {{provider_id}}/
│       ├── config.ts      # OAuth, permissions, UI config
│       └── index.ts       # Provider definition & registration
├── services/
│   └── {{provider_id}}/
│       ├── client.ts      # API client setup
│       └── messages.ts    # Service functions
└── api/
    └── routes/
        └── {{provider_id}}/
            └── messages.ts  # Elysia routes
```

## Environment Variables

Add to your `.env`:

```env
{{PROVIDER_UPPER}}_CLIENT_ID=your_client_id
{{PROVIDER_UPPER}}_CLIENT_SECRET=your_client_secret
```

## Testing

1. Run the dev server: `bun dev`
2. Check the API docs: `http://localhost:3000/api/v1/docs`
3. Verify your provider appears in the docs
4. Test OAuth flow through the linked accounts UI
