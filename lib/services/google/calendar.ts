import type { calendar_v3 } from "googleapis";

import { getCalendarClient } from "./client";

// Types
export interface EventListOptions {
  calendarId?: string;
  maxResults?: number;
  pageToken?: string;
  timeMin?: string;
  timeMax?: string;
  q?: string;
}

export interface EventTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface EventAttendee {
  email: string;
  responseStatus?: string;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: EventTime;
  end: EventTime;
  attendees?: EventAttendee[];
  htmlLink?: string;
  hangoutLink?: string;
}

export interface EventListResult {
  events: CalendarEvent[];
  nextPageToken?: string;
}

export interface CreateEventOptions {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: EventTime;
  end: EventTime;
  attendees?: { email: string }[];
  conferenceData?: boolean;
  sendUpdates?: "all" | "externalOnly" | "none";
}

export interface UpdateEventOptions {
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: EventTime;
  end?: EventTime;
  attendees?: { email: string }[];
  sendUpdates?: "all" | "externalOnly" | "none";
}

/**
 * Transform Google Calendar event to our format.
 */
function transformEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: event.id || "",
    summary: event.summary ?? undefined,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: {
      dateTime: event.start?.dateTime ?? undefined,
      date: event.start?.date ?? undefined,
      timeZone: event.start?.timeZone ?? undefined,
    },
    end: {
      dateTime: event.end?.dateTime ?? undefined,
      date: event.end?.date ?? undefined,
      timeZone: event.end?.timeZone ?? undefined,
    },
    attendees: event.attendees?.map((a) => ({
      email: a.email || "",
      responseStatus: a.responseStatus ?? undefined,
    })),
    htmlLink: event.htmlLink ?? undefined,
    hangoutLink: event.hangoutLink ?? undefined,
  };
}

/**
 * List calendar events.
 */
export async function listEvents(
  accessToken: string,
  options: EventListOptions = {}
): Promise<EventListResult> {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.events.list({
    calendarId: options.calendarId || "primary",
    maxResults: options.maxResults || 50,
    pageToken: options.pageToken,
    timeMin: options.timeMin,
    timeMax: options.timeMax,
    q: options.q,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = (response.data.items || []).map(transformEvent);
  const nextPageToken = response.data.nextPageToken ?? undefined;

  return { events, nextPageToken };
}

/**
 * Get a single calendar event.
 */
export async function getEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = "primary"
): Promise<CalendarEvent | null> {
  const calendar = getCalendarClient(accessToken);

  try {
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    return transformEvent(response.data);
  } catch (error) {
    console.error("Failed to get event:", error);
    return null;
  }
}

/**
 * Create a calendar event.
 */
export async function createEvent(
  accessToken: string,
  options: CreateEventOptions
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken);

  const requestBody: calendar_v3.Schema$Event = {
    summary: options.summary,
    description: options.description,
    location: options.location,
    start: options.start,
    end: options.end,
    attendees: options.attendees,
  };

  // Add conference data if requested
  let conferenceDataVersion: 0 | 1 = 0;
  if (options.conferenceData) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `meet_${Date.now()}`,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
    conferenceDataVersion = 1;
  }

  const response = await calendar.events.insert({
    calendarId: options.calendarId || "primary",
    requestBody,
    conferenceDataVersion,
    sendUpdates: options.sendUpdates || "none",
  });

  return transformEvent(response.data);
}

/**
 * Update a calendar event.
 */
export async function updateEvent(
  accessToken: string,
  eventId: string,
  options: UpdateEventOptions
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken);

  const requestBody: calendar_v3.Schema$Event = {};

  if (options.summary !== undefined) requestBody.summary = options.summary;
  if (options.description !== undefined)
    requestBody.description = options.description;
  if (options.location !== undefined) requestBody.location = options.location;
  if (options.start !== undefined) requestBody.start = options.start;
  if (options.end !== undefined) requestBody.end = options.end;
  if (options.attendees !== undefined) requestBody.attendees = options.attendees;

  const response = await calendar.events.patch({
    calendarId: options.calendarId || "primary",
    eventId,
    requestBody,
    sendUpdates: options.sendUpdates || "none",
  });

  return transformEvent(response.data);
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = "primary",
  sendUpdates: "all" | "externalOnly" | "none" = "none"
): Promise<void> {
  const calendar = getCalendarClient(accessToken);

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates,
  });
}

// ============================================================================
// Calendar List (requires calendar.readonly scope)
// ============================================================================

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  timeZone?: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
  primary?: boolean;
}

export interface CalendarListResult {
  calendars: CalendarListEntry[];
  nextPageToken?: string;
}

export interface CalendarListOptions {
  maxResults?: number;
  pageToken?: string;
  showDeleted?: boolean;
  showHidden?: boolean;
}

/**
 * List all calendars the user has access to.
 */
export async function listCalendars(
  accessToken: string,
  options: CalendarListOptions = {}
): Promise<CalendarListResult> {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.calendarList.list({
    maxResults: options.maxResults || 100,
    pageToken: options.pageToken,
    showDeleted: options.showDeleted,
    showHidden: options.showHidden,
  });

  const calendars: CalendarListEntry[] = (response.data.items || []).map(
    (cal) => ({
      id: cal.id || "",
      summary: cal.summary || "",
      description: cal.description ?? undefined,
      location: cal.location ?? undefined,
      timeZone: cal.timeZone ?? undefined,
      colorId: cal.colorId ?? undefined,
      backgroundColor: cal.backgroundColor ?? undefined,
      foregroundColor: cal.foregroundColor ?? undefined,
      accessRole: (cal.accessRole as CalendarListEntry["accessRole"]) || "reader",
      primary: cal.primary ?? undefined,
    })
  );

  return {
    calendars,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/**
 * Get a single calendar by ID.
 */
export async function getCalendar(
  accessToken: string,
  calendarId: string
): Promise<CalendarListEntry | null> {
  const calendar = getCalendarClient(accessToken);

  try {
    const response = await calendar.calendarList.get({
      calendarId,
    });

    return {
      id: response.data.id || calendarId,
      summary: response.data.summary || "",
      description: response.data.description ?? undefined,
      location: response.data.location ?? undefined,
      timeZone: response.data.timeZone ?? undefined,
      colorId: response.data.colorId ?? undefined,
      backgroundColor: response.data.backgroundColor ?? undefined,
      foregroundColor: response.data.foregroundColor ?? undefined,
      accessRole:
        (response.data.accessRole as CalendarListEntry["accessRole"]) || "reader",
      primary: response.data.primary ?? undefined,
    };
  } catch (error) {
    console.error("Failed to get calendar:", error);
    return null;
  }
}

// ============================================================================
// Free/Busy Query (requires calendar.readonly scope)
// ============================================================================

export interface FreeBusyRequestItem {
  id: string;
}

export interface FreeBusyOptions {
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  items: FreeBusyRequestItem[];
}

export interface FreeBusyPeriod {
  start: string;
  end: string;
}

export interface FreeBusyCalendarResult {
  busy: FreeBusyPeriod[];
  errors?: Array<{ domain: string; reason: string }>;
}

export interface FreeBusyResult {
  timeMin: string;
  timeMax: string;
  calendars: Record<string, FreeBusyCalendarResult>;
}

/**
 * Query free/busy information for calendars.
 */
export async function queryFreeBusy(
  accessToken: string,
  options: FreeBusyOptions
): Promise<FreeBusyResult> {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      timeZone: options.timeZone,
      items: options.items,
    },
  });

  const calendars: Record<string, FreeBusyCalendarResult> = {};

  if (response.data.calendars) {
    for (const [calId, calData] of Object.entries(response.data.calendars)) {
      calendars[calId] = {
        busy: (calData.busy || []).map((period) => ({
          start: period.start || "",
          end: period.end || "",
        })),
        errors: calData.errors?.map((e) => ({
          domain: e.domain || "",
          reason: e.reason || "",
        })),
      };
    }
  }

  return {
    timeMin: response.data.timeMin || options.timeMin,
    timeMax: response.data.timeMax || options.timeMax,
    calendars,
  };
}

// ============================================================================
// Quick Add (requires calendar.events scope)
// ============================================================================

/**
 * Create an event from natural language text.
 * Example: "Meeting with Bob tomorrow at 3pm"
 */
export async function quickAddEvent(
  accessToken: string,
  text: string,
  calendarId: string = "primary",
  sendUpdates: "all" | "externalOnly" | "none" = "none"
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken);

  const response = await calendar.events.quickAdd({
    calendarId,
    text,
    sendUpdates,
  });

  return transformEvent(response.data);
}
