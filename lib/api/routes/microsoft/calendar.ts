import { Elysia, t } from "elysia";

import { verifyApiKey, getUserMicrosoftTokens } from "@/lib/api/auth";
import { hasPermission } from "@/lib/api/permissions";
import { checkAccess, trackUsage } from "@/lib/api/billing";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  cancelEvent,
  listCalendars,
  getCalendar,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  getSchedule,
  acceptEvent,
  declineEvent,
  tentativelyAcceptEvent,
  getCalendarView,
} from "@/lib/services/microsoft/calendar";

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
  name: t.Optional(t.String()),
  responseStatus: t.Optional(
    t.Union([
      t.Literal("none"),
      t.Literal("accepted"),
      t.Literal("declined"),
      t.Literal("tentativelyAccepted"),
      t.Literal("notResponded"),
    ])
  ),
  type: t.Optional(
    t.Union([t.Literal("required"), t.Literal("optional"), t.Literal("resource")])
  ),
});

const OrganizerSchema = t.Object({
  email: t.String(),
  name: t.Optional(t.String()),
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
  onlineMeetingUrl: t.Optional(t.Union([t.String(), t.Null()])),
  isAllDay: t.Optional(t.Boolean()),
  isCancelled: t.Optional(t.Boolean()),
  isOrganizer: t.Optional(t.Boolean()),
  organizer: t.Optional(OrganizerSchema),
  recurrence: t.Optional(t.Object({ pattern: t.Optional(t.String()) })),
  showAs: t.Optional(
    t.Union([
      t.Literal("free"),
      t.Literal("tentative"),
      t.Literal("busy"),
      t.Literal("oof"),
      t.Literal("workingElsewhere"),
      t.Literal("unknown"),
    ])
  ),
  importance: t.Optional(
    t.Union([t.Literal("low"), t.Literal("normal"), t.Literal("high")])
  ),
  sensitivity: t.Optional(
    t.Union([
      t.Literal("normal"),
      t.Literal("personal"),
      t.Literal("private"),
      t.Literal("confidential"),
    ])
  ),
});

const EventListSchema = t.Object({
  events: t.Array(EventSchema),
  nextPageToken: t.Optional(t.String()),
});

// Calendar list schemas
const CalendarListEntrySchema = t.Object({
  id: t.String(),
  name: t.String(),
  color: t.Optional(t.String()),
  isDefaultCalendar: t.Optional(t.Boolean()),
  canEdit: t.Optional(t.Boolean()),
  canShare: t.Optional(t.Boolean()),
  canViewPrivateItems: t.Optional(t.Boolean()),
  owner: t.Optional(OrganizerSchema),
});

const CalendarListSchema = t.Object({
  calendars: t.Array(CalendarListEntrySchema),
  nextPageToken: t.Optional(t.String()),
});

// Free/Busy schemas
const FreeBusyPeriodSchema = t.Object({
  start: t.String(),
  end: t.String(),
  status: t.Union([
    t.Literal("free"),
    t.Literal("tentative"),
    t.Literal("busy"),
    t.Literal("oof"),
    t.Literal("workingElsewhere"),
    t.Literal("unknown"),
  ]),
});

const FreeBusyScheduleResultSchema = t.Object({
  scheduleId: t.String(),
  availabilityView: t.String(),
  scheduleItems: t.Array(FreeBusyPeriodSchema),
  error: t.Optional(
    t.Object({
      message: t.String(),
      responseCode: t.String(),
    })
  ),
});

const FreeBusyResultSchema = t.Object({
  timeMin: t.String(),
  timeMax: t.String(),
  schedules: t.Array(FreeBusyScheduleResultSchema),
});

// ============================================================================
// Auth Macro
// ============================================================================

/**
 * Microsoft Calendar auth macro - validates API key, checks billing, and retrieves Microsoft access token
 */
const msCalendarAuth = new Elysia({ name: "ms-calendar-auth" }).macro({
  msCalendarAuth: {
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

      // Check for any Microsoft calendar permission
      const hasRead = hasPermission(result.data.permissions, "microsoft", "calendar:read");
      const hasWrite = hasPermission(result.data.permissions, "microsoft", "calendar:write");

      if (!hasRead && !hasWrite) {
        return status(403);
      }

      // Get Microsoft tokens
      const tokens = await getUserMicrosoftTokens(result.data.userId);
      if (!tokens?.accessToken) {
        set.status = 401;
        return {
          error: "unauthorized",
          message: "No Microsoft account linked. Please connect your Microsoft account in the dashboard.",
        };
      }

      // Track API usage
      await trackUsage(result.data.userId);

      return {
        microsoftAccessToken: tokens.accessToken,
        permissions: result.data.permissions,
        userId: result.data.userId,
      };
    },
  },
});

// ============================================================================
// Routes
// ============================================================================

export const microsoftCalendarRoutes = new Elysia({ prefix: "/microsoft/calendar" })
  .use(msCalendarAuth)

  // ========== CALENDARS ==========

  // List calendars
  .get(
    "/calendars",
    async ({ query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:read",
        };
      }

      const result = await listCalendars(microsoftAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
      });

      return result;
    },
    {
      msCalendarAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 100 })),
        pageToken: t.Optional(t.String()),
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
        tags: ["Microsoft Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single calendar
  .get(
    "/calendars/:id",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:read",
        };
      }

      const calendar = await getCalendar(microsoftAccessToken!, params.id);

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
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Calendar ID" }),
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
        tags: ["Microsoft Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Create calendar
  .post(
    "/calendars",
    async ({ body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      const calendar = await createCalendar(
        microsoftAccessToken!,
        body.name,
        body.color
      );

      set.status = 201;
      return calendar;
    },
    {
      msCalendarAuth: true,
      body: t.Object({
        name: t.String({ description: "Calendar name" }),
        color: t.Optional(t.String({ description: "Calendar color" })),
      }),
      response: {
        201: CalendarListEntrySchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Create calendar",
        description: "Create a new calendar. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update calendar
  .patch(
    "/calendars/:id",
    async ({ params, body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      const calendar = await updateCalendar(microsoftAccessToken!, params.id, {
        name: body.name,
        color: body.color,
      });

      return calendar;
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Calendar ID" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ description: "Calendar name" })),
        color: t.Optional(t.String({ description: "Calendar color" })),
      }),
      response: {
        200: CalendarListEntrySchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update calendar",
        description: "Update a calendar. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete calendar
  .delete(
    "/calendars/:id",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      await deleteCalendar(microsoftAccessToken!, params.id);
      return { success: true };
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Calendar ID" }),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Delete calendar",
        description: "Delete a calendar. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Calendars"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== FREE/BUSY ==========

  // Get schedule (free/busy)
  .post(
    "/schedule",
    async ({ body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:read",
        };
      }

      const result = await getSchedule(microsoftAccessToken!, {
        timeMin: body.timeMin,
        timeMax: body.timeMax,
        timeZone: body.timeZone,
        schedules: body.schedules,
      });

      return result;
    },
    {
      msCalendarAuth: true,
      body: t.Object({
        timeMin: t.String({ description: "Start of the interval (ISO 8601 datetime)" }),
        timeMax: t.String({ description: "End of the interval (ISO 8601 datetime)" }),
        timeZone: t.Optional(t.String({ description: "Time zone (e.g., 'America/New_York')" })),
        schedules: t.Array(t.String(), { description: "Email addresses to query free/busy for" }),
      }),
      response: {
        200: FreeBusyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Get schedule (free/busy)",
        description:
          "Query free/busy information for one or more users. Requires `calendar:read` permission.",
        tags: ["Microsoft Calendar - Schedule"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== EVENTS ==========

  // List events
  .get(
    "/events",
    async ({ query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:read",
        };
      }

      const result = await listEvents(microsoftAccessToken!, {
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
      msCalendarAuth: true,
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID (omit for primary calendar)" })),
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
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get calendar view (expands recurring events)
  .get(
    "/calendarView",
    async ({ query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:read",
        };
      }

      const result = await getCalendarView(microsoftAccessToken!, {
        calendarId: query.calendarId,
        startDateTime: query.startDateTime,
        endDateTime: query.endDateTime,
        maxResults: query.maxResults,
        pageToken: query.pageToken,
      });

      return result;
    },
    {
      msCalendarAuth: true,
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID (omit for primary calendar)" })),
        startDateTime: t.String({ description: "Start of date range (ISO 8601 datetime)" }),
        endDateTime: t.String({ description: "End of date range (ISO 8601 datetime)" }),
        maxResults: t.Optional(t.Number({ default: 50 })),
        pageToken: t.Optional(t.String()),
      }),
      response: {
        200: EventListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Get calendar view",
        description:
          "Get a view of events within a date range. Expands recurring events into instances. Requires `calendar:read` permission.",
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single event
  .get(
    "/events/:id",
    async ({ params, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:read",
        };
      }

      const event = await getEvent(microsoftAccessToken!, params.id, query.calendarId);

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
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
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
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Create event
  .post(
    "/events",
    async ({ body, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      const event = await createEvent(microsoftAccessToken!, {
        calendarId: query.calendarId,
        summary: body.summary,
        description: body.description,
        location: body.location,
        start: body.start,
        end: body.end,
        attendees: body.attendees,
        isOnlineMeeting: body.isOnlineMeeting,
        showAs: body.showAs,
        importance: body.importance,
        sensitivity: body.sensitivity,
        isAllDay: body.isAllDay,
      });

      set.status = 201;
      return event;
    },
    {
      msCalendarAuth: true,
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID (omit for primary calendar)" })),
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
        attendees: t.Optional(
          t.Array(
            t.Object({
              email: t.String(),
              name: t.Optional(t.String()),
              type: t.Optional(t.Union([t.Literal("required"), t.Literal("optional")])),
            })
          )
        ),
        isOnlineMeeting: t.Optional(t.Boolean({ description: "Add Teams meeting link" })),
        showAs: t.Optional(
          t.Union([
            t.Literal("free"),
            t.Literal("tentative"),
            t.Literal("busy"),
            t.Literal("oof"),
            t.Literal("workingElsewhere"),
            t.Literal("unknown"),
          ])
        ),
        importance: t.Optional(
          t.Union([t.Literal("low"), t.Literal("normal"), t.Literal("high")])
        ),
        sensitivity: t.Optional(
          t.Union([
            t.Literal("normal"),
            t.Literal("personal"),
            t.Literal("private"),
            t.Literal("confidential"),
          ])
        ),
        isAllDay: t.Optional(t.Boolean()),
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
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update event
  .patch(
    "/events/:id",
    async ({ params, body, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      const event = await updateEvent(microsoftAccessToken!, params.id, {
        calendarId: query.calendarId,
        summary: body.summary,
        description: body.description,
        location: body.location,
        start: body.start,
        end: body.end,
        attendees: body.attendees,
        isOnlineMeeting: body.isOnlineMeeting,
        showAs: body.showAs,
        importance: body.importance,
        sensitivity: body.sensitivity,
      });

      return event;
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
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
        attendees: t.Optional(
          t.Array(
            t.Object({
              email: t.String(),
              name: t.Optional(t.String()),
              type: t.Optional(t.Union([t.Literal("required"), t.Literal("optional")])),
            })
          )
        ),
        isOnlineMeeting: t.Optional(t.Boolean()),
        showAs: t.Optional(
          t.Union([
            t.Literal("free"),
            t.Literal("tentative"),
            t.Literal("busy"),
            t.Literal("oof"),
            t.Literal("workingElsewhere"),
            t.Literal("unknown"),
          ])
        ),
        importance: t.Optional(
          t.Union([t.Literal("low"), t.Literal("normal"), t.Literal("high")])
        ),
        sensitivity: t.Optional(
          t.Union([
            t.Literal("normal"),
            t.Literal("personal"),
            t.Literal("private"),
            t.Literal("confidential"),
          ])
        ),
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
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete event
  .delete(
    "/events/:id",
    async ({ params, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      await deleteEvent(microsoftAccessToken!, params.id, query.calendarId);
      return { success: true };
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
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
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Cancel event (with notification to attendees)
  .post(
    "/events/:id/cancel",
    async ({ params, body, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      await cancelEvent(
        microsoftAccessToken!,
        params.id,
        body?.comment,
        query.calendarId
      );
      return { success: true };
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
      }),
      body: t.Optional(
        t.Object({
          comment: t.Optional(t.String({ description: "Cancellation message to attendees" })),
        })
      ),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Cancel event",
        description:
          "Cancel an event and notify attendees. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Events"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== EVENT RESPONSES ==========

  // Accept event
  .post(
    "/events/:id/accept",
    async ({ params, body, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      await acceptEvent(
        microsoftAccessToken!,
        params.id,
        body?.comment,
        body?.sendResponse ?? true,
        query.calendarId
      );
      return { success: true };
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
      }),
      body: t.Optional(
        t.Object({
          comment: t.Optional(t.String({ description: "Response comment" })),
          sendResponse: t.Optional(t.Boolean({ default: true })),
        })
      ),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Accept event invitation",
        description: "Accept a calendar event invitation. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Event Responses"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Decline event
  .post(
    "/events/:id/decline",
    async ({ params, body, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      await declineEvent(
        microsoftAccessToken!,
        params.id,
        body?.comment,
        body?.sendResponse ?? true,
        query.calendarId
      );
      return { success: true };
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
      }),
      body: t.Optional(
        t.Object({
          comment: t.Optional(t.String({ description: "Response comment" })),
          sendResponse: t.Optional(t.Boolean({ default: true })),
        })
      ),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Decline event invitation",
        description: "Decline a calendar event invitation. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Event Responses"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Tentatively accept event
  .post(
    "/events/:id/tentative",
    async ({ params, body, query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "calendar:write")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:calendar:write",
        };
      }

      await tentativelyAcceptEvent(
        microsoftAccessToken!,
        params.id,
        body?.comment,
        body?.sendResponse ?? true,
        query.calendarId
      );
      return { success: true };
    },
    {
      msCalendarAuth: true,
      params: t.Object({
        id: t.String({ description: "Event ID" }),
      }),
      query: t.Object({
        calendarId: t.Optional(t.String({ description: "Calendar ID" })),
      }),
      body: t.Optional(
        t.Object({
          comment: t.Optional(t.String({ description: "Response comment" })),
          sendResponse: t.Optional(t.Boolean({ default: true })),
        })
      ),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Tentatively accept event",
        description:
          "Tentatively accept a calendar event invitation. Requires `calendar:write` permission.",
        tags: ["Microsoft Calendar - Event Responses"],
        security: [{ apiKey: [] }],
      },
    }
  );
