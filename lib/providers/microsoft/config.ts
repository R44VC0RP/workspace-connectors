/**
 * Microsoft Provider Configuration
 *
 * Self-contained configuration for the Microsoft 365 provider.
 * This file defines all OAuth, permissions, and metadata for Microsoft.
 */

import type { PermissionDefinition, OAuthConfig, ProviderUIConfig } from "../core/types";

// ============================================================================
// OAuth Configuration
// ============================================================================

export const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  // Outlook Mail scopes
  "Mail.Read",
  "Mail.Send",
  "Mail.ReadWrite",
  // Outlook Calendar scopes
  "Calendars.Read",
  "Calendars.ReadWrite",
];

export const microsoftOAuthConfig: OAuthConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || "",
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
  scopes: MICROSOFT_SCOPES,
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  additionalParams: {
    prompt: "consent",
  },
};

// ============================================================================
// UI Configuration
// ============================================================================

export const microsoftUIConfig: ProviderUIConfig = {
  name: "Microsoft",
  description: "Access Outlook and Microsoft Calendar",
  icon: "MicrosoftLogo", // Component name reference
  color: "#00A4EF",
};

// ============================================================================
// Permissions
// ============================================================================

export const microsoftPermissions: Record<string, PermissionDefinition> = {
  // Outlook Mail permissions
  "mail:read": {
    label: "Read emails",
    description: "Read email messages, conversations, and folders",
    scope: "Mail.Read",
  },
  "mail:send": {
    label: "Send emails",
    description: "Send new email messages",
    scope: "Mail.Send",
  },
  "mail:modify": {
    label: "Modify emails",
    description: "Trash/untrash messages, move between folders, modify read status",
    scope: "Mail.ReadWrite",
  },
  // Outlook Calendar permissions
  "calendar:read": {
    label: "Read calendar",
    description: "Read calendar events and free/busy information",
    scope: "Calendars.Read",
  },
  "calendar:write": {
    label: "Write calendar",
    description: "Create, update, and delete calendar events",
    scope: "Calendars.ReadWrite",
  },
};

export const microsoftPermissionGroups: Record<string, string[]> = {
  // Read-only access to both Outlook Mail and Calendar
  readonly: ["mail:read", "calendar:read"],

  // Full Outlook Mail access (read, send, modify)
  fullMail: ["mail:read", "mail:send", "mail:modify"],

  // Full Calendar access (read, write)
  fullCalendar: ["calendar:read", "calendar:write"],

  // Full access to everything
  fullAccess: [
    "mail:read",
    "mail:send",
    "mail:modify",
    "calendar:read",
    "calendar:write",
  ],
};

export const microsoftScopeToPermissions: Record<string, string[]> = {
  "Mail.Read": ["mail:read"],
  "Mail.Send": ["mail:send"],
  "Mail.ReadWrite": ["mail:modify"],
  "Calendars.Read": ["calendar:read"],
  "Calendars.ReadWrite": ["calendar:write"],
};

// ============================================================================
// OpenAPI Tags
// ============================================================================

export const microsoftOpenApiTags = [
  { name: "Microsoft Mail - Messages", description: "Outlook message operations" },
  { name: "Microsoft Mail - Folders", description: "Outlook folder operations" },
  { name: "Microsoft Mail - Conversations", description: "Outlook conversation operations" },
  { name: "Microsoft Mail - Drafts", description: "Outlook draft operations" },
  { name: "Microsoft Calendar - Calendars", description: "Outlook calendar list operations" },
  { name: "Microsoft Calendar - Events", description: "Outlook event operations" },
  { name: "Microsoft Calendar - Event Responses", description: "Outlook event response operations" },
  { name: "Microsoft Calendar - Schedule", description: "Outlook free/busy operations" },
];

// ============================================================================
// Type Exports
// ============================================================================

export type MicrosoftPermission = keyof typeof microsoftPermissions;
