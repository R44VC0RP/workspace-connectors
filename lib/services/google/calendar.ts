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
