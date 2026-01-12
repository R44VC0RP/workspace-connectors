# Provider Architecture

This document describes the modular provider system for Workspace Connectors.

## Overview

The provider system allows adding new OAuth providers (Google, Microsoft, Slack, etc.) in a standardized way. Each provider is self-contained with its own:

- OAuth configuration
- Permission definitions
- UI metadata
- Service implementations
- API routes

## Directory Structure

```
lib/
├── providers/
│   ├── core/                    # Core types and registry
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── registry.ts          # Provider registry
│   │   └── index.ts             # Public exports
│   │
│   ├── google/                  # Google provider
│   │   ├── config.ts            # OAuth, permissions, UI config
│   │   └── index.ts             # Provider definition
│   │
│   ├── microsoft/               # Microsoft provider
│   │   ├── config.ts
│   │   └── index.ts
│   │
│   ├── _template/               # Template for new providers
│   │   ├── config.ts.template
│   │   ├── index.ts.template
│   │   └── README.md
│   │
│   └── index.ts                 # Auto-registration entry point
│
├── services/                    # Service implementations
│   ├── google/
│   │   ├── client.ts            # API client factory
│   │   ├── gmail.ts             # Gmail operations
│   │   └── calendar.ts          # Calendar operations
│   │
│   └── microsoft/
│       ├── client.ts
│       ├── outlook.ts
│       └── calendar.ts
│
└── api/
    └── routes/                  # Elysia API routes
        ├── google/
        │   ├── mail.ts
        │   └── calendar.ts
        │
        └── microsoft/
            ├── mail.ts
            └── calendar.ts
```

## Adding a New Provider

### Before (9+ file changes)

Previously, adding a new provider required changes to:

1. `convex/auth.ts` - OAuth config
2. `lib/api/permissions.ts` - Permissions
3. `lib/services/{provider}/client.ts` - API client
4. `lib/services/{provider}/*.ts` - Service files
5. `convex/tokens.ts` - Token management
6. `convex/http.ts` - Token HTTP endpoint
7. `lib/api/routes/{provider}/*.ts` - Routes
8. `lib/api/index.ts` - Route registration + OpenAPI tags
9. `components/linked-accounts.tsx` - UI

### After (3 file changes + new provider files)

Now adding a provider requires:

1. **Create provider config** (`lib/providers/{provider}/config.ts`)
   - OAuth configuration
   - Permission definitions
   - UI metadata
   - OpenAPI tags

2. **Create provider index** (`lib/providers/{provider}/index.ts`)
   - Import services and routes
   - Create ProviderConfig
   - Auto-register via `providerRegistry.register()`

3. **Register in main index** (`lib/providers/index.ts`)
   - Add `import "./{provider}"`

The routes, OpenAPI docs, and permissions are automatically aggregated by the registry.

### Remaining Manual Steps

These still require manual changes:

- `convex/auth.ts` - Better Auth social provider config
- `convex/tokens.ts` - Token queries/mutations (Convex-specific)
- `convex/http.ts` - Token HTTP endpoints (Convex-specific)

These are Convex-specific and would require a separate abstraction.

## Provider Configuration

Each provider defines a `ProviderConfig`:

```typescript
interface ProviderConfig {
  id: string;                           // "google", "microsoft"
  
  ui: {
    name: string;                       // "Google"
    description: string;                // "Access Gmail and Calendar"
    icon: string;                       // Component name
    color?: string;                     // Brand color
  };
  
  oauth: {
    clientId: string;
    clientSecret: string;
    scopes: string[];
    tokenEndpoint: string;
    authorizationEndpoint?: string;
    additionalParams?: Record<string, string>;
  };
  
  permissions: Record<string, {
    label: string;
    description: string;
    scope: string;
    requiresReauth?: boolean;
  }>;
  
  permissionGroups: Record<string, string[]>;
  
  scopeToPermissions: Record<string, string[]>;
  
  services: {
    mail?: ServiceModule;
    calendar?: ServiceModule;
  };
  
  routes: {
    mail?: Elysia;
    calendar?: Elysia;
  };
  
  openApiTags: Array<{ name: string; description: string }>;
}
```

## Registry Functions

The registry provides utilities for aggregating provider data:

```typescript
import { 
  providerRegistry,
  getAllPermissions,
  getAllOpenApiTags,
  getAllRoutes,
  getProviderUIConfigs,
  hasPermission,
} from "@/lib/providers";

// Get all registered providers
const providers = providerRegistry.getAll();

// Get aggregated permissions from all providers
const permissions = getAllPermissions();
// { google: { "mail:read": {...} }, microsoft: { "mail:read": {...} } }

// Get all routes for mounting
const routes = getAllRoutes();

// Get UI configs for linked accounts component
const uiConfigs = getProviderUIConfigs();
```

## Usage in API

The API automatically mounts all provider routes:

```typescript
// lib/api/index.ts
import "@/lib/providers"; // Triggers registration

import { getAllOpenApiTags, getAllRoutes } from "@/lib/providers";

const tags = getAllOpenApiTags();
const routes = getAllRoutes();

// Routes are mounted dynamically
for (const route of routes) {
  api = api.use(route);
}
```

## Benefits

1. **Self-contained providers** - All provider config in one place
2. **Automatic registration** - Import triggers registration
3. **Reduced boilerplate** - Less manual wiring
4. **Type-safe** - Full TypeScript support
5. **Consistent structure** - Template for new providers
6. **Easy to extend** - Add new providers without touching core code
