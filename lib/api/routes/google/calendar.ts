import { Elysia, t } from "elysia";

import { verifyApiKey, getUserGoogleTokens } from "@/lib/api/auth";
import { hasPermission } from "@/lib/api/permissions";
import { checkAccess, trackUsage } from "@/lib/api/billing";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listCalendars,
  getCalendar,
  queryFreeBusy,
  quickAddEvent,
} from "@/lib/services/google/calendar";

// ============================================================================
// OpenAPI Response Schemas
// ============================================================================

const ErrorSchema = t.Object({
  error: t.String(),
  message: t.String(),
});

// Event schemas
const EventTimeSchema = t.Object({
  dateTime: t.Optional(t.String()),
  date: t.Optional(t.String()),
  timeZone: t.Optional(t.String()),
});

const EventAttendeeSchema = t.Object({
  email: t.String(),
  responseStatus: t.Optional(t.String()),
});

const EventSchema = t.Object({
  id: t.String(),
  summary: t.Optional(t.String()),
  description: t.Optional(t.String()),
  location: t.Optional(t.String()),
  start: EventTimeSchema,
  end: EventTimeSchema,
  attendees: t.Optional(t.Array(EventAttendeeSchema)),
  htmlLink: t.Optional(t.String()),
  hangoutLink: t.Optional(t.String()),
});

const EventListSchema = t.Object({
  events: t.Array(EventSchema),
  nextPageToken: t.Optional(t.String()),
});

// Calendar list schemas
const CalendarListEntrySchema = t.Object({
  id: t.String(),
  summary: t.String(),
  description: t.Optional(t.String()),
  location: t.Optional(t.String()),
  timeZone: t.Optional(t.String()),
  colorId: t.Optional(t.String()),
  backgroundColor: t.Optional(t.String()),
  foregroundColor: t.Optional(t.String()),
  accessRole: t.Union([
    t.Literal("freeBusyReader"),
    t.Literal("reader"),
    t.Literal("writer"),
    t.Literal("owner"),
  ]),
  primary: t.Optional(t.Boolean()),
});

const CalendarListSchema = t.Object({
  calendars: t.Array(CalendarListEntrySchema),
  nextPageToken: t.Optional(t.String()),
});

// Free/Busy schemas
const FreeBusyPeriodSchema = t.Object({
  start: t.String(),
  end: t.String(),
});

const FreeBusyCalendarResultSchema = t.Object({
  busy: t.Array(FreeBusyPeriodSchema),
  errors: t.Optional(
    t.Array(
      t.Object({
        domain: t.String(),
        reason: t.String(),
      })
    )
  ),
});

const FreeBusyResultSchema = t.Object({
  timeMin: t.String(),
  timeMax: t.String(),
  calendars: t.Record(t.String(), FreeBusyCalendarResultSchema),
});

// ============================================================================
// Auth Macro
// ============================================================================

/**
 * Calendar auth macro - validates API key, checks billing, and retrieves Google access token
 */
const calendarAuth = new Elysia({ name: "calendar-auth" }).macro({
  calendarAuth: {
    async resolve({ headers, status, set }) {
      const authHeader = headers["authorization"];
      const apiKeyHeader = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!apiKeyHeader) {
        return status(401);
      }

      const result = await verifyApiKey(apiKeyHeader);
      if (!result.valid || !result.data) {
        return status(401);
      }

      // Check billing access (Autumn)
      const billingCheck = await checkAccess(result.data.userId);
      if (!billingCheck.allowed) {
        set.status = 402;
        return {
          error: "payment_required",
          message: billingCheck.error || "Upgrade to access the Workspace Connector API",
        };
      }

      // Check for any calendar permission
      const hasRead = hasPermission(result.data.permissions, "google", "calendar:read");
      const hasWrite = hasPermission(result.data.permissions, "google", "calendar:write");

      if (!hasRead && !hasWrite) {
        return status(403);
      }

      // Get Google tokens
      const tokens = await getUserGoogleTokens(result.data.userId);
      if (!tokens?.accessToken) {
        return status(401);
      }

      // Track API usage
      await trackUsage(result.data.userId);

      return {
        googleAccessToken: tokens.accessToken,
        permissions: result.data.permissions,
        userId: result.data.userId,
      };
    },
  },
});

// ============================================================================
// Routes
// ============================================================================

export const googleCalendarRoutes = new Elysia({ prefix: "/google/calendar" })
  .use(calendarAuth)

  // ========== CALENDARS ==========

  // List calendars
  .get(
    "/calendars",
    async ({ query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:read",
        };
      }

      const result = await listCalendars(googleAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        showDeleted: query.showDeleted,
        showHidden: query.showHidden,
      });

      return result;
    },
    {
      calendarAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 100 })),
        pageToken: t.Optional(t.String()),
        showDeleted: t.Optional(t.Boolean({ default: false })),
        showHidden: t.Optional(t.Boolean({ default: false })),
      }),
      response: {
        200: CalendarListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List calendars",
        description: "Retrieve all calendars the user has access to. Requires `calendar:read` permission.",
        tags: ["Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single calendar
  .get(
    "/calendars/:id",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:read",
        };
      }

      const calendar = await getCalendar(googleAccessToken!, params.id);

      if (!calendar) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Calendar not found",
        };
      }

      return calendar;
    },
    {
      calendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Calendar ID (use 'primary' for the user's primary calendar)" }),
      }),
      response: {
        200: CalendarListEntrySchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get calendar",
        description: "Retrieve a specific calendar by ID. Requires `calendar:read` permission.",
        tags: ["Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== FREE/BUSY ==========

  // Query free/busy
  .post(
    "/freebusy",
    async ({ body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:read",
        };
      }

      const result = await queryFreeBusy(googleAccessToken!, {
        timeMin: body.timeMin,
        timeMax: body.timeMax,
        timeZone: body.timeZone,
        items: body.items,
      });

      return result;
    },
    {
      calendarAuth: true,
      body: t.Object({
        timeMin: t.String({ description: "Start of the interval (ISO 8601 datetime)" }),
        timeMax: t.String({ description: "End of the interval (ISO 8601 datetime)" }),
        timeZone: t.Optional(t.String({ description: "Time zone (e.g., 'America/New_York')" })),
        items: t.Array(
          t.Object({
            id: t.String({ description: "Calendar ID to query" }),
          }),
          { description: "List of calendars to query" }
        ),
      }),
      response: {
        200: FreeBusyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Query free/busy",
        description:
          "Query free/busy information for one or more calendars. Requires `calendar:read` permission.",
        tags: ["Calendar - Free/Busy"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== EVENTS ==========

  // List events
  .get(
    "/events",
    async ({ query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:read",
        };
      }

      const result = await listEvents(googleAccessToken!, {
        calendarId: query.calendarId,
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        timeMin: query.timeMin,
        timeMax: query.timeMax,
        q: query.q,
      });

      return result;
    },
    {
      calendarAuth: true,
      query: t.Object({
        calendarId: t.Optional(t.String({ default: "primary" })),
        maxResults: t.Optional(t.Number({ default: 50 })),
        pageToken: t.Optional(t.String()),
        timeMin: t.Optional(t.String({ description: "ISO 8601 datetime" })),
        timeMax: t.Optional(t.String({ description: "ISO 8601 datetime" })),
        q: t.Optional(t.String({ description: "Free text search" })),
      }),
      response: {
        200: EventListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List calendar events",
        description: "Retrieve a list of calendar events. Requires `calendar:read` permission.",
        tags: ["Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single event
  .get(
    "/events/:id",
    async ({ params, query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:read",
        };
      }

      const event = await getEvent(
        googleAccessToken!,
        params.id,
        query.calendarId || "primary"
      );

      if (!event) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Event not found",
        };
      }

      return event;
    },
    {
      calendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ default: "primary" })),
      }),
      response: {
        200: EventSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get calendar event",
        description: "Retrieve a specific calendar event by ID. Requires `calendar:read` permission.",
        tags: ["Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Create event
  .post(
    "/events",
    async ({ body, query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      const event = await createEvent(googleAccessToken!, {
        calendarId: query.calendarId,
        summary: body.summary,
        description: body.description,
        location: body.location,
        start: body.start,
        end: body.end,
        attendees: body.attendees,
        conferenceData: body.conferenceData,
        sendUpdates: query.sendUpdates,
      });

      set.status = 201;
      return event;
    },
    {
      calendarAuth: true,
      query: t.Object({
        calendarId: t.Optional(t.String({ default: "primary" })),
        sendUpdates: t.Optional(
          t.Union([t.Literal("all"), t.Literal("externalOnly"), t.Literal("none")])
        ),
      }),
      body: t.Object({
        summary: t.String({ description: "Event title" }),
        description: t.Optional(t.String()),
        location: t.Optional(t.String()),
        start: t.Object({
          dateTime: t.Optional(t.String({ description: "ISO 8601 datetime" })),
          date: t.Optional(t.String({ description: "Date (YYYY-MM-DD) for all-day events" })),
          timeZone: t.Optional(t.String()),
        }),
        end: t.Object({
          dateTime: t.Optional(t.String({ description: "ISO 8601 datetime" })),
          date: t.Optional(t.String({ description: "Date (YYYY-MM-DD) for all-day events" })),
          timeZone: t.Optional(t.String()),
        }),
        attendees: t.Optional(t.Array(t.Object({ email: t.String() }))),
        conferenceData: t.Optional(
          t.Boolean({ description: "Add Google Meet link" })
        ),
      }),
      response: {
        201: EventSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Create calendar event",
        description: "Create a new calendar event. Requires `calendar:write` permission.",
        tags: ["Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Quick add event
  .post(
    "/events/quickAdd",
    async ({ body, query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      const event = await quickAddEvent(
        googleAccessToken!,
        body.text,
        query.calendarId || "primary",
        query.sendUpdates || "none"
      );

      set.status = 201;
      return event;
    },
    {
      calendarAuth: true,
      query: t.Object({
        calendarId: t.Optional(t.String({ default: "primary" })),
        sendUpdates: t.Optional(
          t.Union([t.Literal("all"), t.Literal("externalOnly"), t.Literal("none")])
        ),
      }),
      body: t.Object({
        text: t.String({
          description: "Natural language text describing the event (e.g., 'Meeting with Bob tomorrow at 3pm')",
        }),
      }),
      response: {
        201: EventSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Quick add event",
        description:
          "Create an event from natural language text. Google Calendar parses the text to extract event details. Requires `calendar:write` permission.",
        tags: ["Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update event
  .patch(
    "/events/:id",
    async ({ params, body, query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      const event = await updateEvent(googleAccessToken!, params.id, {
        calendarId: query.calendarId,
        summary: body.summary,
        description: body.description,
        location: body.location,
        start: body.start,
        end: body.end,
        attendees: body.attendees,
        sendUpdates: query.sendUpdates,
      });

      return event;
    },
    {
      calendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ default: "primary" })),
        sendUpdates: t.Optional(
          t.Union([t.Literal("all"), t.Literal("externalOnly"), t.Literal("none")])
        ),
      }),
      body: t.Object({
        summary: t.Optional(t.String()),
        description: t.Optional(t.String()),
        location: t.Optional(t.String()),
        start: t.Optional(
          t.Object({
            dateTime: t.Optional(t.String()),
            date: t.Optional(t.String()),
            timeZone: t.Optional(t.String()),
          })
        ),
        end: t.Optional(
          t.Object({
            dateTime: t.Optional(t.String()),
            date: t.Optional(t.String()),
            timeZone: t.Optional(t.String()),
          })
        ),
        attendees: t.Optional(t.Array(t.Object({ email: t.String() }))),
      }),
      response: {
        200: EventSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update calendar event",
        description: "Update an existing calendar event. Requires `calendar:write` permission.",
        tags: ["Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete event
  .delete(
    "/events/:id",
    async ({ params, query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      await deleteEvent(
        googleAccessToken!,
        params.id,
        query.calendarId || "primary",
        query.sendUpdates || "none"
      );

      return { success: true };
    },
    {
      calendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ default: "primary" })),
        sendUpdates: t.Optional(
          t.Union([t.Literal("all"), t.Literal("externalOnly"), t.Literal("none")])
        ),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Delete calendar event",
        description: "Delete a calendar event. Requires `calendar:write` permission.",
        tags: ["Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  );
