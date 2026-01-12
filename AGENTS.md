# AGENTS.md - Workspace Connectors

Guidelines for AI coding agents working in this repository.

## Project Overview

**Next.js 16** application with App Router, **React 19**, **TypeScript 5** (strict), **Tailwind CSS v4**, **shadcn/ui**, **Convex** backend, **Better Auth** (Google OAuth), and **Bun** as package manager.

## Build, Lint, and Test Commands

```bash
# Development
bun dev                            # Start Next.js dev server at http://localhost:3000
bunx convex dev                    # Start Convex dev server (run in separate terminal)
bun run build                      # Production build
bun start                          # Start production server

# Linting
bun lint                           # Lint entire project
bun lint app/page.tsx              # Lint single file
bun lint --fix                     # Auto-fix lint errors

# Type Checking
bun tsc --noEmit                   # Type check entire project

# Testing (when configured - recommended: Vitest)
bun vitest                         # Run all tests in watch mode
bun vitest run                     # Run tests once (CI mode)
bun vitest path/to/test.ts         # Run single test file
bun vitest -t "test name"          # Run tests matching pattern
```

## File Structure

```
app/                    # Next.js App Router pages and layouts
  layout.tsx            # Root layout with ConvexClientProvider
  page.tsx              # Home page
  globals.css           # Global styles with Tailwind
  api/auth/[...all]/    # Better Auth route handlers
  ConvexClientProvider.tsx  # Convex + Better Auth provider
convex/                 # Convex backend
  auth.ts               # Better Auth configuration with Google OAuth
  auth.config.ts        # Convex auth config
  convex.config.ts      # Convex app config
  http.ts               # HTTP router with auth routes
  _generated/           # Auto-generated Convex types (don't edit)
lib/                    # Shared utilities
  auth-client.ts        # Client-side auth (signIn, signOut, useSession)
  auth-server.ts        # Server-side auth (preloadAuthQuery, fetchAuthMutation)
public/                 # Static assets
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** - never use `any` without justification
- Use `type` imports for type-only imports
- Use explicit return types for exported functions
- Prefer interfaces for object shapes, types for unions/primitives

```typescript
// Good - type import
import type { Metadata } from "next";

// Bad - regular import for types
import { Metadata } from "next";
```

### Import Order

1. React/Next.js core imports
2. Third-party libraries
3. Internal absolute imports (`@/...`)
4. Relative imports
5. Type-only imports
6. CSS imports (last)

```typescript
import Image from "next/image";

import { someLib } from "third-party";

import { Component } from "@/components/Component";

import type { CustomType } from "@/types";

import "./styles.css";
```

### Path Aliases

Use `@/*` alias for imports from project root:
```typescript
import { Button } from "@/components/Button";  // Good
import { Button } from "../../../components/Button";  // Avoid
```

### React Components

- Function declarations for page components, arrow functions for helpers
- Export components as default for pages/layouts
- Use `Readonly<>` wrapper for props with children

```typescript
// Page component
export default function Home() {
  return <main>...</main>;
}

// Layout with children
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <html><body>{children}</body></html>;
}

// Client component (only when needed)
"use client";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### UI Components (shadcn/ui)

**Always prefer shadcn/ui components over custom styling.** This ensures consistent design and reduces CSS maintenance.

```bash
bunx shadcn@latest add button        # Add a component
bunx shadcn@latest add card input    # Add multiple components
```

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Use shadcn components with variants
<Button variant="outline" size="lg">Click me</Button>
<Card className="w-full max-w-3xl">...</Card>
```

Icons use **Tabler Icons** (`@tabler/icons-react`):
```typescript
import { IconBrandGoogle, IconSettings } from "@tabler/icons-react";
<IconBrandGoogle className="h-4 w-4" />
```

### Tailwind CSS v4

- Use Tailwind for layout and spacing, shadcn for components
- Responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Dark mode: `dark:` prefix
- Class order: layout -> spacing -> typography -> colors -> effects

```tsx
<div className="flex min-h-screen items-center justify-center">
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files/Folders | kebab-case | `user-profile/`, `api-utils.ts` |
| Components | PascalCase | `UserProfile`, `NavBar` |
| Functions | camelCase | `getUserData`, `handleSubmit` |
| Constants | SCREAMING_SNAKE | `API_BASE_URL` |
| Types/Interfaces | PascalCase | `UserData`, `ApiResponse` |
| CSS variables | kebab-case | `--font-geist-sans` |

### Error Handling

```typescript
try {
  const data = await fetchData();
} catch (error) {
  console.error("Failed to fetch data:", error);
  throw new Error("Unable to load data. Please try again.");
}
```

### Next.js Specifics

- Use `next/image` for all images (automatic optimization)
- Use `next/font` for fonts (configured with Geist)
- Prefer Server Components unless client interactivity needed
- Add `"use client"` directive only when necessary
- Export `metadata` for SEO

```typescript
export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};
```

### Environment Variables

- Never commit `.env` files
- Use `NEXT_PUBLIC_` prefix for client-side variables
- Access server-only vars: `process.env.SECRET_KEY`

## ESLint Configuration

Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Run `bun lint --fix` before committing.

## Authentication (Better Auth + Convex)

### Client-Side Auth

Use `lib/auth-client.ts` for client components:

```typescript
"use client";
import { signIn, signOut, useSession } from "@/lib/auth-client";

// Sign in with Google
await signIn.social({ provider: "google" });

// Sign out
await signOut();

// Get session (hook)
const { data: session, isPending } = useSession();
```

### Server-Side Auth

Use `lib/auth-server.ts` for server components and actions:

```typescript
import { preloadAuthQuery, fetchAuthMutation, isAuthenticated } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

// Preload queries in server components
const preloaded = await preloadAuthQuery(api.auth.getCurrentUser);

// Call mutations from server actions
await fetchAuthMutation(api.someModule.someMutation, { arg: "value" });

// Check authentication
const authed = await isAuthenticated();
```

### Convex Queries/Mutations

```typescript
// In client components
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const user = useQuery(api.auth.getCurrentUser);
const doSomething = useMutation(api.someModule.someMutation);
```

## Git Workflow

- Keep commits focused and atomic
- Write descriptive commit messages
- Don't commit generated files (`.next/`, `node_modules/`, `convex/_generated/`)
