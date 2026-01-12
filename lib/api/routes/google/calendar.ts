import { Elysia, t } from "elysia";

import { verifyApiKey, getUserGoogleTokens, hasPermission } from "@/lib/api/auth";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/services/google/calendar";

// Response schemas for OpenAPI documentation
const EventTimeSchema = t.Object({
  dateTime: t.Optional(t.String()),
  date: t.Optional(t.String()),
  timeZone: t.Optional(t.String()),
});

const EventSchema = t.Object({
  id: t.String(),
  summary: t.Optional(t.String()),
  description: t.Optional(t.String()),
  location: t.Optional(t.String()),
  start: EventTimeSchema,
  end: EventTimeSchema,
  attendees: t.Optional(
    t.Array(
      t.Object({
        email: t.String(),
        responseStatus: t.Optional(t.String()),
      })
    )
  ),
  htmlLink: t.Optional(t.String()),
  hangoutLink: t.Optional(t.String()),
});

const EventListSchema = t.Object({
  events: t.Array(EventSchema),
  nextPageToken: t.Optional(t.String()),
});

const ErrorSchema = t.Object({
  error: t.String(),
  message: t.String(),
});

/**
 * Calendar auth macro - validates API key and retrieves Google access token
 */
const calendarAuth = new Elysia({ name: "calendar-auth" }).macro({
  calendarAuth: {
    async resolve({ headers, status }) {
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

      // Check for calendar permissions
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

      return {
        googleAccessToken: tokens.accessToken,
        permissions: result.data.permissions,
        userId: result.data.userId,
      };
    },
  },
});

export const googleCalendarRoutes = new Elysia({ prefix: "/google/calendar" })
  .use(calendarAuth)
  // List events
  .get(
    "/events",
    async ({ query, googleAccessToken }) => {
      const result = await listEvents(googleAccessToken, {
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
        403: ErrorSchema,
      },
      detail: {
        summary: "List calendar events",
        description: "Retrieve a list of calendar events",
        tags: ["Calendar"],
        security: [{ apiKey: [] }],
      },
    }
  )
  // Get single event
  .get(
    "/events/:id",
    async ({ params, query, googleAccessToken, set }) => {
      const event = await getEvent(
        googleAccessToken,
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
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get calendar event",
        description: "Retrieve a specific calendar event by ID",
        tags: ["Calendar"],
        security: [{ apiKey: [] }],
      },
    }
  )
  // Create event
  .post(
    "/events",
    async ({ body, query, googleAccessToken, permissions, set }) => {
      // Check write permission
      if (!hasPermission(permissions, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      const event = await createEvent(googleAccessToken, {
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
        403: ErrorSchema,
      },
      detail: {
        summary: "Create calendar event",
        description: "Create a new calendar event",
        tags: ["Calendar"],
        security: [{ apiKey: [] }],
      },
    }
  )
  // Update event
  .patch(
    "/events/:id",
    async ({ params, body, query, googleAccessToken, permissions, set }) => {
      // Check write permission
      if (!hasPermission(permissions, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      const event = await updateEvent(googleAccessToken, params.id, {
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
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update calendar event",
        description: "Update an existing calendar event",
        tags: ["Calendar"],
        security: [{ apiKey: [] }],
      },
    }
  )
  // Delete event
  .delete(
    "/events/:id",
    async ({ params, query, googleAccessToken, permissions, set }) => {
      // Check write permission
      if (!hasPermission(permissions, "google", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:calendar:write",
        };
      }

      await deleteEvent(
        googleAccessToken,
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
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Delete calendar event",
        description: "Delete a calendar event",
        tags: ["Calendar"],
        security: [{ apiKey: [] }],
      },
    }
  );
