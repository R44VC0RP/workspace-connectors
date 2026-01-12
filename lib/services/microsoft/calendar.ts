/**
 * Microsoft Outlook Calendar Service
 *
 * Provides calendar operations via Microsoft Graph API.
 * Mirrors the Google Calendar service structure for consistency.
 */

import { getGraphClient } from "./client";

// ============================================================================
// Types
// ============================================================================

export interface EventListOptions {
  calendarId?: string;
  maxResults?: number;
  pageToken?: string;
  timeMin?: string; // ISO 8601 datetime
  timeMax?: string; // ISO 8601 datetime
  q?: string; // $search query
}

export interface EventTime {
  dateTime?: string;
  date?: string; // For all-day events
  timeZone?: string;
}

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus?: "none" | "accepted" | "declined" | "tentativelyAccepted" | "notResponded";
  type?: "required" | "optional" | "resource";
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
  onlineMeetingUrl?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOrganizer?: boolean;
  organizer?: {
    email: string;
    name?: string;
  };
  recurrence?: {
    pattern?: string;
  };
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  importance?: "low" | "normal" | "high";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
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
  attendees?: { email: string; name?: string; type?: "required" | "optional" }[];
  isOnlineMeeting?: boolean;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  importance?: "low" | "normal" | "high";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
  isAllDay?: boolean;
  sendInvitations?: boolean;
}

export interface UpdateEventOptions {
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: EventTime;
  end?: EventTime;
  attendees?: { email: string; name?: string; type?: "required" | "optional" }[];
  isOnlineMeeting?: boolean;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  importance?: "low" | "normal" | "high";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
  sendUpdates?: boolean;
}

// Calendar List types
export interface CalendarListEntry {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  canShare?: boolean;
  canViewPrivateItems?: boolean;
  owner?: {
    email: string;
    name?: string;
  };
}

export interface CalendarListResult {
  calendars: CalendarListEntry[];
  nextPageToken?: string;
}

export interface CalendarListOptions {
  maxResults?: number;
  pageToken?: string;
}

// Free/Busy types
export interface FreeBusyOptions {
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  schedules: string[]; // Email addresses to check
}

export interface FreeBusyPeriod {
  start: string;
  end: string;
  status: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
}

export interface FreeBusyScheduleResult {
  scheduleId: string;
  availabilityView: string;
  scheduleItems: FreeBusyPeriod[];
  error?: {
    message: string;
    responseCode: string;
  };
}

export interface FreeBusyResult {
  timeMin: string;
  timeMax: string;
  schedules: FreeBusyScheduleResult[];
}

// ============================================================================
// Graph API Response Types
// ============================================================================

interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType?: string;
    content?: string;
  };
  location?: {
    displayName?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      countryOrRegion?: string;
      postalCode?: string;
    };
  };
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOrganizer?: boolean;
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  attendees?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
    status?: {
      response?: string;
      time?: string;
    };
    type?: string;
  }>;
  webLink?: string;
  onlineMeetingUrl?: string;
  onlineMeeting?: {
    joinUrl?: string;
  };
  recurrence?: {
    pattern?: {
      type?: string;
      interval?: number;
      daysOfWeek?: string[];
    };
    range?: {
      type?: string;
      startDate?: string;
      endDate?: string;
    };
  };
  showAs?: string;
  importance?: string;
  sensitivity?: string;
}

interface GraphCalendar {
  id: string;
  name?: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  canShare?: boolean;
  canViewPrivateItems?: boolean;
  owner?: {
    name?: string;
    address?: string;
  };
}

interface GraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

interface GraphScheduleItem {
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
  status?: string;
}

interface GraphScheduleResponse {
  scheduleId?: string;
  availabilityView?: string;
  scheduleItems?: GraphScheduleItem[];
  error?: {
    message?: string;
    responseCode?: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract next page token from @odata.nextLink URL.
 */
function extractNextPageToken(nextLink?: string): string | undefined {
  if (!nextLink) return undefined;
  return nextLink;
}

/**
 * Transform Graph event to our CalendarEvent format.
 */
function transformEvent(event: GraphEvent): CalendarEvent {
  // Map Graph response status to our format
  const mapResponseStatus = (
    status?: string
  ): EventAttendee["responseStatus"] => {
    switch (status) {
      case "accepted":
        return "accepted";
      case "declined":
        return "declined";
      case "tentativelyAccepted":
        return "tentativelyAccepted";
      case "notResponded":
        return "notResponded";
      default:
        return "none";
    }
  };

  // Map attendee type
  const mapAttendeeType = (type?: string): EventAttendee["type"] => {
    switch (type) {
      case "required":
        return "required";
      case "optional":
        return "optional";
      case "resource":
        return "resource";
      default:
        return "required";
    }
  };

  return {
    id: event.id,
    summary: event.subject,
    description: event.body?.content || event.bodyPreview,
    location: event.location?.displayName,
    start: {
      dateTime: event.start?.dateTime,
      timeZone: event.start?.timeZone,
    },
    end: {
      dateTime: event.end?.dateTime,
      timeZone: event.end?.timeZone,
    },
    isAllDay: event.isAllDay,
    isCancelled: event.isCancelled,
    isOrganizer: event.isOrganizer,
    organizer: event.organizer?.emailAddress
      ? {
          email: event.organizer.emailAddress.address || "",
          name: event.organizer.emailAddress.name,
        }
      : undefined,
    attendees: event.attendees?.map((a) => ({
      email: a.emailAddress?.address || "",
      name: a.emailAddress?.name,
      responseStatus: mapResponseStatus(a.status?.response),
      type: mapAttendeeType(a.type),
    })),
    htmlLink: event.webLink,
    onlineMeetingUrl: event.onlineMeeting?.joinUrl || event.onlineMeetingUrl,
    recurrence: event.recurrence
      ? {
          pattern: event.recurrence.pattern?.type,
        }
      : undefined,
    showAs: event.showAs as CalendarEvent["showAs"],
    importance: event.importance as CalendarEvent["importance"],
    sensitivity: event.sensitivity as CalendarEvent["sensitivity"],
  };
}

/**
 * Build attendees array for Graph API.
 */
function buildAttendees(
  attendees?: { email: string; name?: string; type?: "required" | "optional" }[]
): Array<{
  emailAddress: { address: string; name?: string };
  type: string;
}> {
  if (!attendees) return [];
  return attendees.map((a) => ({
    emailAddress: {
      address: a.email,
      name: a.name,
    },
    type: a.type || "required",
  }));
}

// ============================================================================
// Event Operations
// ============================================================================

/**
 * List calendar events.
 */
export async function listEvents(
  accessToken: string,
  options: EventListOptions = {}
): Promise<EventListResult> {
  const client = getGraphClient(accessToken);

  const params = new URLSearchParams();
  params.set("$top", String(options.maxResults || 50));
  params.set("$orderby", "start/dateTime");
  params.set(
    "$select",
    "id,subject,bodyPreview,location,start,end,isAllDay,isCancelled,isOrganizer,organizer,attendees,webLink,onlineMeeting,showAs,importance"
  );

  if (options.timeMin) {
    params.set(
      "$filter",
      `start/dateTime ge '${options.timeMin}'${options.timeMax ? ` and end/dateTime le '${options.timeMax}'` : ""}`
    );
  }

  if (options.q) {
    params.set("$search", `"${options.q}"`);
  }

  let endpoint = "/me/calendar/events";
  if (options.calendarId && options.calendarId !== "primary") {
    endpoint = `/me/calendars/${options.calendarId}/events`;
  }

  let url = `${endpoint}?${params.toString()}`;
  if (options.pageToken) {
    url = options.pageToken;
  }

  const response = await client.get<GraphListResponse<GraphEvent>>(url);

  return {
    events: response.value.map(transformEvent),
    nextPageToken: extractNextPageToken(response["@odata.nextLink"]),
  };
}

/**
 * Get a single calendar event.
 */
export async function getEvent(
  accessToken: string,
  eventId: string,
  calendarId?: string
): Promise<CalendarEvent | null> {
  const client = getGraphClient(accessToken);

  try {
    let endpoint = `/me/calendar/events/${eventId}`;
    if (calendarId && calendarId !== "primary") {
      endpoint = `/me/calendars/${calendarId}/events/${eventId}`;
    }

    const response = await client.get<GraphEvent>(endpoint);
    return transformEvent(response);
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
  const client = getGraphClient(accessToken);

  const event: Record<string, unknown> = {
    subject: options.summary,
    body: options.description
      ? {
          contentType: "text",
          content: options.description,
        }
      : undefined,
    location: options.location
      ? {
          displayName: options.location,
        }
      : undefined,
    start: options.isAllDay
      ? { dateTime: options.start.date, timeZone: options.start.timeZone || "UTC" }
      : { dateTime: options.start.dateTime, timeZone: options.start.timeZone || "UTC" },
    end: options.isAllDay
      ? { dateTime: options.end.date, timeZone: options.end.timeZone || "UTC" }
      : { dateTime: options.end.dateTime, timeZone: options.end.timeZone || "UTC" },
    isAllDay: options.isAllDay,
    attendees: buildAttendees(options.attendees),
    isOnlineMeeting: options.isOnlineMeeting,
    onlineMeetingProvider: options.isOnlineMeeting ? "teamsForBusiness" : undefined,
    showAs: options.showAs || "busy",
    importance: options.importance || "normal",
    sensitivity: options.sensitivity || "normal",
  };

  // Remove undefined values
  Object.keys(event).forEach((key) => {
    if (event[key] === undefined) {
      delete event[key];
    }
  });

  let endpoint = "/me/calendar/events";
  if (options.calendarId && options.calendarId !== "primary") {
    endpoint = `/me/calendars/${options.calendarId}/events`;
  }

  const response = await client.post<GraphEvent>(endpoint, event);
  return transformEvent(response);
}

/**
 * Update a calendar event.
 */
export async function updateEvent(
  accessToken: string,
  eventId: string,
  options: UpdateEventOptions
): Promise<CalendarEvent> {
  const client = getGraphClient(accessToken);

  const updates: Record<string, unknown> = {};

  if (options.summary !== undefined) {
    updates.subject = options.summary;
  }
  if (options.description !== undefined) {
    updates.body = {
      contentType: "text",
      content: options.description,
    };
  }
  if (options.location !== undefined) {
    updates.location = {
      displayName: options.location,
    };
  }
  if (options.start !== undefined) {
    updates.start = {
      dateTime: options.start.dateTime || options.start.date,
      timeZone: options.start.timeZone || "UTC",
    };
  }
  if (options.end !== undefined) {
    updates.end = {
      dateTime: options.end.dateTime || options.end.date,
      timeZone: options.end.timeZone || "UTC",
    };
  }
  if (options.attendees !== undefined) {
    updates.attendees = buildAttendees(options.attendees);
  }
  if (options.isOnlineMeeting !== undefined) {
    updates.isOnlineMeeting = options.isOnlineMeeting;
    if (options.isOnlineMeeting) {
      updates.onlineMeetingProvider = "teamsForBusiness";
    }
  }
  if (options.showAs !== undefined) {
    updates.showAs = options.showAs;
  }
  if (options.importance !== undefined) {
    updates.importance = options.importance;
  }
  if (options.sensitivity !== undefined) {
    updates.sensitivity = options.sensitivity;
  }

  let endpoint = `/me/calendar/events/${eventId}`;
  if (options.calendarId && options.calendarId !== "primary") {
    endpoint = `/me/calendars/${options.calendarId}/events/${eventId}`;
  }

  const response = await client.patch<GraphEvent>(endpoint, updates);
  return transformEvent(response);
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  accessToken: string,
  eventId: string,
  calendarId?: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  let endpoint = `/me/calendar/events/${eventId}`;
  if (calendarId && calendarId !== "primary") {
    endpoint = `/me/calendars/${calendarId}/events/${eventId}`;
  }

  await client.delete(endpoint);
}

/**
 * Cancel a calendar event (sends cancellation to attendees).
 */
export async function cancelEvent(
  accessToken: string,
  eventId: string,
  comment?: string,
  calendarId?: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  let endpoint = `/me/calendar/events/${eventId}/cancel`;
  if (calendarId && calendarId !== "primary") {
    endpoint = `/me/calendars/${calendarId}/events/${eventId}/cancel`;
  }

  await client.post(endpoint, comment ? { comment } : {});
}

// ============================================================================
// Calendar List Operations
// ============================================================================

/**
 * List all calendars the user has access to.
 */
export async function listCalendars(
  accessToken: string,
  options: CalendarListOptions = {}
): Promise<CalendarListResult> {
  const client = getGraphClient(accessToken);

  const params = new URLSearchParams();
  params.set("$top", String(options.maxResults || 100));

  let url = `/me/calendars?${params.toString()}`;
  if (options.pageToken) {
    url = options.pageToken;
  }

  const response = await client.get<GraphListResponse<GraphCalendar>>(url);

  const calendars: CalendarListEntry[] = response.value.map((cal) => ({
    id: cal.id,
    name: cal.name || "",
    color: cal.color,
    isDefaultCalendar: cal.isDefaultCalendar,
    canEdit: cal.canEdit,
    canShare: cal.canShare,
    canViewPrivateItems: cal.canViewPrivateItems,
    owner: cal.owner
      ? {
          email: cal.owner.address || "",
          name: cal.owner.name,
        }
      : undefined,
  }));

  return {
    calendars,
    nextPageToken: extractNextPageToken(response["@odata.nextLink"]),
  };
}

/**
 * Get a single calendar by ID.
 */
export async function getCalendar(
  accessToken: string,
  calendarId: string
): Promise<CalendarListEntry | null> {
  const client = getGraphClient(accessToken);

  try {
    const response = await client.get<GraphCalendar>(
      `/me/calendars/${calendarId}`
    );

    return {
      id: response.id,
      name: response.name || "",
      color: response.color,
      isDefaultCalendar: response.isDefaultCalendar,
      canEdit: response.canEdit,
      canShare: response.canShare,
      canViewPrivateItems: response.canViewPrivateItems,
      owner: response.owner
        ? {
            email: response.owner.address || "",
            name: response.owner.name,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Failed to get calendar:", error);
    return null;
  }
}

/**
 * Create a new calendar.
 */
export async function createCalendar(
  accessToken: string,
  name: string,
  color?: string
): Promise<CalendarListEntry> {
  const client = getGraphClient(accessToken);

  const response = await client.post<GraphCalendar>("/me/calendars", {
    name,
    color,
  });

  return {
    id: response.id,
    name: response.name || name,
    color: response.color,
    isDefaultCalendar: response.isDefaultCalendar,
    canEdit: response.canEdit,
    canShare: response.canShare,
    canViewPrivateItems: response.canViewPrivateItems,
  };
}

/**
 * Update a calendar.
 */
export async function updateCalendar(
  accessToken: string,
  calendarId: string,
  updates: { name?: string; color?: string }
): Promise<CalendarListEntry> {
  const client = getGraphClient(accessToken);

  const response = await client.patch<GraphCalendar>(
    `/me/calendars/${calendarId}`,
    updates
  );

  return {
    id: response.id,
    name: response.name || "",
    color: response.color,
    isDefaultCalendar: response.isDefaultCalendar,
    canEdit: response.canEdit,
    canShare: response.canShare,
    canViewPrivateItems: response.canViewPrivateItems,
  };
}

/**
 * Delete a calendar.
 */
export async function deleteCalendar(
  accessToken: string,
  calendarId: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  await client.delete(`/me/calendars/${calendarId}`);
}

// ============================================================================
// Free/Busy Operations
// ============================================================================

/**
 * Get free/busy schedule information for users.
 */
export async function getSchedule(
  accessToken: string,
  options: FreeBusyOptions
): Promise<FreeBusyResult> {
  const client = getGraphClient(accessToken);

  const response = await client.post<{ value: GraphScheduleResponse[] }>(
    "/me/calendar/getSchedule",
    {
      schedules: options.schedules,
      startTime: {
        dateTime: options.timeMin,
        timeZone: options.timeZone || "UTC",
      },
      endTime: {
        dateTime: options.timeMax,
        timeZone: options.timeZone || "UTC",
      },
      availabilityViewInterval: 30, // 30-minute intervals
    }
  );

  const schedules: FreeBusyScheduleResult[] = response.value.map((schedule) => ({
    scheduleId: schedule.scheduleId || "",
    availabilityView: schedule.availabilityView || "",
    scheduleItems: (schedule.scheduleItems || []).map((item) => ({
      start: item.start?.dateTime || "",
      end: item.end?.dateTime || "",
      status: (item.status as FreeBusyPeriod["status"]) || "unknown",
    })),
    error: schedule.error
      ? {
          message: schedule.error.message || "",
          responseCode: schedule.error.responseCode || "",
        }
      : undefined,
  }));

  return {
    timeMin: options.timeMin,
    timeMax: options.timeMax,
    schedules,
  };
}

// ============================================================================
// Event Response Operations
// ============================================================================

/**
 * Accept a calendar event invitation.
 */
export async function acceptEvent(
  accessToken: string,
  eventId: string,
  comment?: string,
  sendResponse: boolean = true,
  calendarId?: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  let endpoint = `/me/calendar/events/${eventId}/accept`;
  if (calendarId && calendarId !== "primary") {
    endpoint = `/me/calendars/${calendarId}/events/${eventId}/accept`;
  }

  await client.post(endpoint, {
    comment,
    sendResponse,
  });
}

/**
 * Decline a calendar event invitation.
 */
export async function declineEvent(
  accessToken: string,
  eventId: string,
  comment?: string,
  sendResponse: boolean = true,
  calendarId?: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  let endpoint = `/me/calendar/events/${eventId}/decline`;
  if (calendarId && calendarId !== "primary") {
    endpoint = `/me/calendars/${calendarId}/events/${eventId}/decline`;
  }

  await client.post(endpoint, {
    comment,
    sendResponse,
  });
}

/**
 * Tentatively accept a calendar event invitation.
 */
export async function tentativelyAcceptEvent(
  accessToken: string,
  eventId: string,
  comment?: string,
  sendResponse: boolean = true,
  calendarId?: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  let endpoint = `/me/calendar/events/${eventId}/tentativelyAccept`;
  if (calendarId && calendarId !== "primary") {
    endpoint = `/me/calendars/${calendarId}/events/${eventId}/tentativelyAccept`;
  }

  await client.post(endpoint, {
    comment,
    sendResponse,
  });
}

// ============================================================================
// Calendar View (instances of recurring events)
// ============================================================================

export interface CalendarViewOptions {
  calendarId?: string;
  startDateTime: string;
  endDateTime: string;
  maxResults?: number;
  pageToken?: string;
}

/**
 * Get calendar view (expands recurring events into instances).
 */
export async function getCalendarView(
  accessToken: string,
  options: CalendarViewOptions
): Promise<EventListResult> {
  const client = getGraphClient(accessToken);

  const params = new URLSearchParams();
  params.set("startDateTime", options.startDateTime);
  params.set("endDateTime", options.endDateTime);
  params.set("$top", String(options.maxResults || 50));
  params.set("$orderby", "start/dateTime");
  params.set(
    "$select",
    "id,subject,bodyPreview,location,start,end,isAllDay,isCancelled,isOrganizer,organizer,attendees,webLink,onlineMeeting,showAs,importance"
  );

  let endpoint = "/me/calendar/calendarView";
  if (options.calendarId && options.calendarId !== "primary") {
    endpoint = `/me/calendars/${options.calendarId}/calendarView`;
  }

  let url = `${endpoint}?${params.toString()}`;
  if (options.pageToken) {
    url = options.pageToken;
  }

  const response = await client.get<GraphListResponse<GraphEvent>>(url);

  return {
    events: response.value.map(transformEvent),
    nextPageToken: extractNextPageToken(response["@odata.nextLink"]),
  };
}
