# Workspace Connectors

<img width="1082" height="809" alt="image" src="https://github.com/user-attachments/assets/a07ebc4b-3077-49d8-9cc3-e6cf5342fbf5" />


A unified API for Google Workspace and Microsoft 365. Connect your Gmail, Outlook, and Calendar, generate scoped API keys, and integrate with any application.

**Built by [Inbound](https://inbound.new?utm_source=workspace-connectors)**

## Features

- **Google OAuth Integration** - Connect Gmail and Google Calendar with proper OAuth scopes
- **Microsoft OAuth Integration** - Connect Outlook Mail and Outlook Calendar via Microsoft Graph API
- **Scoped API Keys** - Generate API keys with granular permissions (read/write/send for mail and calendar)
- **Unified REST API** - Consistent endpoints for both Google and Microsoft services
- **OpenAPI Documentation** - Interactive Swagger UI at `/api/v1/docs`
- **LLM-Friendly Docs** - Machine-readable API docs at `/llms.txt`
- **Zero Data Retention** - Your data is never stored or logged

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Backend**: [Convex](https://convex.dev/) for real-time database
- **Auth**: [Better Auth](https://better-auth.com/) with Google/Microsoft OAuth + API Key plugin
- **API**: [Elysia](https://elysiajs.com/) with Swagger/OpenAPI
- **UI**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Runtime**: [Bun](https://bun.sh/)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- A [Convex](https://convex.dev/) account
- Google Cloud Console project with OAuth credentials
- Microsoft Azure app registration (optional, for Microsoft 365 support)

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

# Microsoft OAuth (optional)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret

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

### Microsoft Azure Setup (Optional)

1. Go to [Azure Portal](https://portal.azure.com/) → App registrations
2. Create a new registration
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/microsoft` (development)
   - `https://your-domain.com/api/auth/callback/microsoft` (production)
4. Under "API permissions", add:
   - `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`
   - `Calendars.Read`, `Calendars.ReadWrite`
   - `User.Read`, `offline_access`, `openid`, `profile`, `email`
5. Create a client secret and copy the **secret value** (not the secret ID)

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

### Google Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/google/mail/messages` | List Gmail messages |
| GET | `/api/v1/google/mail/messages/:id` | Get a specific message |
| POST | `/api/v1/google/mail/messages` | Send an email |
| GET | `/api/v1/google/mail/labels` | List labels |
| GET | `/api/v1/google/mail/threads` | List threads |
| GET | `/api/v1/google/mail/drafts` | List drafts |
| GET | `/api/v1/google/calendar/events` | List calendar events |
| POST | `/api/v1/google/calendar/events` | Create an event |
| PATCH | `/api/v1/google/calendar/events/:id` | Update an event |
| DELETE | `/api/v1/google/calendar/events/:id` | Delete an event |
| GET | `/api/v1/google/calendar/calendars` | List calendars |
| POST | `/api/v1/google/calendar/freeBusy` | Query free/busy |

### Microsoft Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/microsoft/mail/messages` | List Outlook messages |
| GET | `/api/v1/microsoft/mail/messages/:id` | Get a specific message |
| POST | `/api/v1/microsoft/mail/messages` | Send an email |
| GET | `/api/v1/microsoft/mail/folders` | List folders |
| GET | `/api/v1/microsoft/mail/drafts` | List drafts |
| GET | `/api/v1/microsoft/calendar/events` | List calendar events |
| POST | `/api/v1/microsoft/calendar/events` | Create an event |
| PATCH | `/api/v1/microsoft/calendar/events/:id` | Update an event |
| DELETE | `/api/v1/microsoft/calendar/events/:id` | Delete an event |
| GET | `/api/v1/microsoft/calendar/calendars` | List calendars |
| POST | `/api/v1/microsoft/calendar/schedule` | Query free/busy |

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
  services/
    google/          # Gmail and Google Calendar services
    microsoft/       # Outlook and Outlook Calendar services
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
