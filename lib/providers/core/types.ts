/**
 * Core Provider Type Definitions
 *
 * These interfaces define the contract that all providers must implement.
 * By following these interfaces, new providers can be added with minimal boilerplate.
 */

// Note: We use 'unknown' for Elysia routes since its generic types are complex
// and vary per route configuration. The registry casts appropriately when mounting.

// ============================================================================
// Permission Types
// ============================================================================

export interface PermissionDefinition {
  label: string;
  description: string;
  scope: string;
  requiresReauth?: boolean;
}

export interface PermissionGroup {
  name: string;
  permissions: string[];
}

// ============================================================================
// Service Types - Mail
// ============================================================================

export interface MailMessageListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  labelIds?: string[];
  folderId?: string;
}

export interface MailMessageSummary {
  id: string;
  threadId: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  labelIds?: string[];
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
}

export interface MailMessageDetail extends MailMessageSummary {
  body?: string;
  bodyHtml?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}

export interface MailMessageListResult {
  messages: MailMessageSummary[];
  nextPageToken?: string;
}

export interface MailSendOptions {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface MailSendResult {
  id: string;
  threadId: string;
}

export interface MailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messageCount?: number;
  unreadCount?: number;
}

export interface MailLabelListResult {
  labels: MailLabel[];
}

export interface MailThread {
  id: string;
  snippet?: string;
  messages?: MailMessageDetail[];
}

export interface MailThreadListResult {
  threads: MailThread[];
  nextPageToken?: string;
}

// ============================================================================
// Service Types - Calendar
// ============================================================================

export interface CalendarListOptions {
  maxResults?: number;
  pageToken?: string;
}

export interface CalendarSummary {
  id: string;
  name: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

export interface CalendarListResult {
  calendars: CalendarSummary[];
  nextPageToken?: string;
}

export interface CalendarEventListOptions {
  calendarId?: string;
  maxResults?: number;
  pageToken?: string;
  timeMin?: string;
  timeMax?: string;
  q?: string;
}

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  optional?: boolean;
  organizer?: boolean;
  self?: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: "confirmed" | "tentative" | "cancelled";
  attendees?: CalendarEventAttendee[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  created?: string;
  updated?: string;
  htmlLink?: string;
  recurringEventId?: string;
  recurrence?: string[];
}

export interface CalendarEventListResult {
  events: CalendarEvent[];
  nextPageToken?: string;
}

export interface CalendarEventCreateOptions {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; optional?: boolean }[];
  recurrence?: string[];
  sendNotifications?: boolean;
}

export interface FreeBusyOptions {
  timeMin: string;
  timeMax: string;
  emails: string[];
}

export interface FreeBusyResult {
  calendars: Record<
    string,
    {
      busy: { start: string; end: string }[];
      errors?: { reason: string }[];
    }
  >;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Service module type - services are passed as modules with exported functions.
 * This allows flexibility while still providing discoverability.
 * The actual function signatures are provider-specific.
 */
export type ServiceModule = Record<string, unknown>;

// ============================================================================
// OAuth Types
// ============================================================================

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  tokenEndpoint: string;
  authorizationEndpoint?: string;
  additionalParams?: Record<string, string>;
}

export interface OAuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  scope: string | null;
}

// ============================================================================
// Provider Definition
// ============================================================================

export interface ProviderUIConfig {
  name: string;
  description: string;
  icon: string; // Icon component name or URL
  color?: string;
}

export interface ProviderConfig {
  /** Unique identifier for the provider (e.g., "google", "microsoft") */
  id: string;

  /** Display name for UI */
  ui: ProviderUIConfig;

  /** OAuth configuration */
  oauth: OAuthConfig;

  /** Permission definitions */
  permissions: Record<string, PermissionDefinition>;

  /** Permission groups for common use cases */
  permissionGroups: Record<string, string[]>;

  /** Scope to permission mapping */
  scopeToPermissions: Record<string, string[]>;

  /** Services provided (module references for programmatic access) */
  services: {
    mail?: ServiceModule;
    calendar?: ServiceModule;
  };

  /** 
   * Elysia route plugins (the actual API implementation)
   * Uses unknown type since Elysia's complex generic types vary per route configuration
   */
  routes: {
    mail?: unknown;
    calendar?: unknown;
  };

  /** OpenAPI tags for documentation */
  openApiTags: Array<{ name: string; description: string }>;
}

// ============================================================================
// Registry Types
// ============================================================================

export type ProviderId = string;

export interface ProviderRegistry {
  register(provider: ProviderConfig): void;
  get(id: ProviderId): ProviderConfig | undefined;
  getAll(): ProviderConfig[];
  getIds(): ProviderId[];
  has(id: ProviderId): boolean;
}
