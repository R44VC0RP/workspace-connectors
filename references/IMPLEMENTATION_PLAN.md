# Workspace Connectors - Implementation Plan

## Overview

A platform where users authenticate, connect their Google/Microsoft accounts, and get scoped API keys to access their connected services (Gmail, Calendar) via a REST API with OpenAPI documentation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                              │
├─────────────────────────────────────────────────────────────────┤
│  /                    │  Public landing page                    │
│  /login               │  Google OAuth sign-in                   │
│  /dashboard           │  User dashboard overview                │
│    /accounts          │  Manage connected accounts              │
│    /api-keys          │  Generate/manage scoped API keys        │
│  /api/auth/[...all]   │  Better Auth handlers                   │
│  /api/v1/[[...slugs]] │  Elysia API (public, key-authenticated) │
├─────────────────────────────────────────────────────────────────┤
│                     Convex Backend                              │
├─────────────────────────────────────────────────────────────────┤
│  Tables (via Better Auth):                                      │
│    - user                                                       │
│    - account (linked OAuth accounts with tokens)                │
│    - apiKey (Better Auth API key plugin)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui
- **Backend**: Convex
- **Auth**: Better Auth with Google OAuth + API Key plugin
- **API**: Elysia with Scalar OpenAPI docs
- **Rate Limiting**: Upstash (future)

## API Key Configuration

- **Prefix**: `wsc_`
- **Plugin**: Better Auth's built-in `apiKey` plugin
- **Permissions format**: `{ "google": ["mail:read", "mail:send", "calendar:read", "calendar:write"] }`

## Initial Scopes (Phase 1)

| Scope | Description |
|-------|-------------|
| `google:mail:read` | Read Gmail messages |
| `google:mail:send` | Send emails via Gmail |
| `google:calendar:read` | Read calendar events |
| `google:calendar:write` | Create/update/delete events |

## Google OAuth Scopes Required

```typescript
const GOOGLE_SCOPES = [
  "openid",
  "email", 
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];
```

## File Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── dashboard/
│   │   ├── page.tsx              # Overview
│   │   ├── accounts/page.tsx     # Connected accounts
│   │   └── api-keys/page.tsx     # API key management
│   └── layout.tsx                # Dashboard layout with nav
├── api/
│   ├── auth/[...all]/route.ts    # Better Auth
│   └── v1/[[...slugs]]/route.ts  # Elysia API
└── page.tsx                      # Landing

convex/
├── auth.ts                       # Better Auth config with API key plugin
├── auth.config.ts                # Convex auth config
├── convex.config.ts              # Convex app config
├── http.ts                       # HTTP routes
└── _generated/                   # Auto-generated (don't edit)

lib/
├── api/
│   ├── index.ts                  # Elysia app composition
│   ├── middleware/
│   │   └── api-key-auth.ts       # API key validation
│   └── routes/
│       └── google/
│           ├── mail.ts           # Gmail endpoints
│           └── calendar.ts       # Calendar endpoints
├── services/
│   └── google/
│       ├── client.ts             # Google API client factory
│       ├── gmail.ts              # Gmail API wrapper
│       └── calendar.ts           # Calendar API wrapper
├── auth-client.ts                # Client-side auth with API key plugin
└── auth-server.ts                # Server-side auth helpers

components/
├── ui/                           # shadcn/ui components
└── dashboard/                    # Dashboard-specific components
```

## Implementation Phases

### Phase 1: API Key System ✅ Current
1. Add Better Auth API key plugin to server config
2. Add API key client plugin
3. Create API keys dashboard page
4. Test key creation/verification

### Phase 2: Google OAuth Scopes
1. Update Google OAuth config with Gmail/Calendar scopes
2. Ensure tokens are stored properly
3. Test token retrieval

### Phase 3: Elysia API Setup
1. Install Elysia + plugins
2. Create catch-all route at /api/v1
3. Set up Scalar OpenAPI docs
4. Create health endpoint

### Phase 4: API Authentication Middleware
1. Create middleware to validate API keys via Better Auth
2. Check permissions against requested endpoint
3. Load user's OAuth tokens

### Phase 5: Google Services
1. Install googleapis package
2. Create Gmail service wrapper
3. Create Calendar service wrapper
4. Handle token refresh

### Phase 6: API Endpoints
1. Gmail endpoints (list, get, send)
2. Calendar endpoints (list, get, create, update, delete)
3. Wire up to services

### Phase 7: Dashboard Polish
1. Account management UI
2. API key scope selection UI
3. Connected accounts display

---

## Implementation Notes

### Note 1: Better Auth API Key Plugin
The API key plugin handles:
- Key generation with custom prefix (`wsc_`)
- Secure hashing before storage
- Permissions system (`{ resource: ["permission1", "permission2"] }`)
- Built-in rate limiting (can use this instead of Upstash initially)
- Key verification endpoint

### Note 2: OAuth Token Storage
Better Auth stores OAuth tokens in the `account` table:
- `accessToken`
- `refreshToken`
- `accessTokenExpiresAt`

Use `auth.api.getAccessToken({ providerId: "google" })` to get tokens (auto-refreshes).

### Note 3: Elysia + Next.js
Mount Elysia at `/api/v1/[[...slugs]]/route.ts`:
```typescript
export const GET = app.handle
export const POST = app.handle
// etc.
```

### Note 4: Google API Scopes
Must request scopes at OAuth time. Update `convex/auth.ts` socialProviders config.

---

## Completed Tasks

- [x] Project setup (Next.js, Convex, Better Auth)
- [x] Google OAuth sign-in
- [x] Basic dashboard with session
- [x] shadcn/ui setup

## Current Sprint

- [ ] Phase 1: API Key System

---

## Future Enhancements (Out of Scope)

- Microsoft/Outlook integration
- Usage tracking/analytics
- Billing/subscriptions
- Additional Gmail operations (drafts, labels)
- Webhook notifications
