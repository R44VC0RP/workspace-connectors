# Workspace Connectors

A unified API for Google Workspace. Connect your Gmail and Calendar, generate scoped API keys, and integrate with any application.

**Built by [Inbound](https://inbound.new?utm_source=workspace-connectors)**

## Features

- **Google OAuth Integration** - Connect Gmail and Calendar with proper OAuth scopes
- **Scoped API Keys** - Generate API keys with granular permissions (read/write for mail and calendar)
- **Unified REST API** - Simple endpoints for Gmail messages and Calendar events
- **OpenAPI Documentation** - Interactive Swagger UI at `/api/v1/docs`
- **LLM-Friendly Docs** - Machine-readable API docs at `/llms.txt`

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Backend**: [Convex](https://convex.dev/) for real-time database
- **Auth**: [Better Auth](https://better-auth.com/) with Google OAuth + API Key plugin
- **API**: [Elysia](https://elysiajs.com/) with Swagger/OpenAPI
- **UI**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Runtime**: [Bun](https://bun.sh/)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- A [Convex](https://convex.dev/) account
- Google Cloud Console project with OAuth credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/R44VC0RP/workspace-connectors.git
cd workspace-connectors

# Install dependencies
bun install
```

### Environment Variables

Create a `.env.local` file:

```env
# Convex
CONVEX_DEPLOYMENT=your_deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Site URL
SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gmail API and Google Calendar API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.com/api/auth/callback/google` (production)

### Development

```bash
# Start the Next.js dev server
bun dev

# In a separate terminal, start Convex
bunx convex dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Usage

### Authentication

All API requests require a Bearer token:

```bash
curl -X GET "https://workspace.inboundemail.com/api/v1/google/mail/messages" \
  -H "Authorization: Bearer your_api_key"
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/google/mail/messages` | List Gmail messages |
| GET | `/api/v1/google/mail/messages/:id` | Get a specific message |
| POST | `/api/v1/google/mail/messages` | Send an email |
| GET | `/api/v1/google/calendar/events` | List calendar events |
| POST | `/api/v1/google/calendar/events` | Create an event |
| PATCH | `/api/v1/google/calendar/events/:id` | Update an event |
| DELETE | `/api/v1/google/calendar/events/:id` | Delete an event |

### Rate Limits

- **100 requests per minute** per API key

## Scripts

```bash
bun dev              # Start development server
bun build            # Build for production (includes llms.txt generation)
bun start            # Start production server
bun lint             # Run ESLint
bun run generate:llms # Generate /llms.txt from OpenAPI spec
```

## Project Structure

```
app/
  (dashboard)/       # Authenticated dashboard routes
  api/               # API routes (Elysia)
  login/             # Login page
convex/
  auth.ts            # Better Auth configuration
  http.ts            # Custom HTTP endpoints
  tokens.ts          # Token management
lib/
  api/               # Elysia API setup and routes
  services/google/   # Gmail and Calendar services
  auth-client.ts     # Client-side auth helpers
  auth-server.ts     # Server-side auth helpers
components/
  ui/                # shadcn/ui components
public/
  llms.txt           # LLM-friendly API documentation
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [API Documentation](https://workspace.inboundemail.com/api/v1/docs)
- [Inbound](https://inbound.new?utm_source=workspace-connectors)
