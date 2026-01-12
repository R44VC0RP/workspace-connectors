/**
 * Google Provider Configuration
 *
 * Self-contained configuration for the Google Workspace provider.
 * This file defines all OAuth, permissions, and metadata for Google.
 */

import type { PermissionDefinition, OAuthConfig, ProviderUIConfig } from "../core/types";

// ============================================================================
// OAuth Configuration
// ============================================================================

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  // Gmail scopes
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.compose",
  // Calendar scopes
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export const googleOAuthConfig: OAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  scopes: GOOGLE_SCOPES,
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  additionalParams: {
    access_type: "offline",
    prompt: "consent",
  },
};

// ============================================================================
// UI Configuration
// ============================================================================

export const googleUIConfig: ProviderUIConfig = {
  name: "Google",
  description: "Access Gmail and Google Calendar",
  icon: "GoogleLogo", // Component name reference
  color: "#4285F4",
};

// ============================================================================
// Permissions
// ============================================================================

export const googlePermissions: Record<string, PermissionDefinition> = {
  // Gmail permissions
  "mail:read": {
    label: "Read emails",
    description: "Read email messages, threads, and labels",
    scope: "gmail.readonly",
  },
  "mail:send": {
    label: "Send emails",
    description: "Send new email messages",
    scope: "gmail.send",
  },
  "mail:modify": {
    label: "Modify emails",
    description: "Trash/untrash messages, add/remove labels",
    scope: "gmail.modify",
    requiresReauth: true,
  },
  "mail:labels": {
    label: "Manage labels",
    description: "Create, update, and delete labels",
    scope: "gmail.labels",
    requiresReauth: true,
  },
  "mail:drafts": {
    label: "Manage drafts",
    description: "Create, update, delete, and send draft messages",
    scope: "gmail.compose",
    requiresReauth: true,
  },
  // Calendar permissions
  "calendar:read": {
    label: "Read calendar",
    description: "Read calendar events and free/busy information",
    scope: "calendar.readonly",
  },
  "calendar:write": {
    label: "Write calendar",
    description: "Create, update, and delete calendar events",
    scope: "calendar.events",
  },
};

export const googlePermissionGroups: Record<string, string[]> = {
  // Read-only access to both Gmail and Calendar
  readonly: ["mail:read", "calendar:read"],

  // Full Gmail access (read, send, modify, labels, drafts)
  fullGmail: ["mail:read", "mail:send", "mail:modify", "mail:labels", "mail:drafts"],

  // Full Calendar access (read, write)
  fullCalendar: ["calendar:read", "calendar:write"],

  // Full access to everything
  fullAccess: [
    "mail:read",
    "mail:send",
    "mail:modify",
    "mail:labels",
    "mail:drafts",
    "calendar:read",
    "calendar:write",
  ],
};

export const googleScopeToPermissions: Record<string, string[]> = {
  "https://www.googleapis.com/auth/gmail.readonly": ["mail:read"],
  "https://www.googleapis.com/auth/gmail.send": ["mail:send"],
  "https://www.googleapis.com/auth/gmail.modify": ["mail:modify"],
  "https://www.googleapis.com/auth/gmail.labels": ["mail:labels"],
  "https://www.googleapis.com/auth/gmail.compose": ["mail:drafts"],
  "https://www.googleapis.com/auth/calendar.readonly": ["calendar:read"],
  "https://www.googleapis.com/auth/calendar.events": ["calendar:write"],
};

// ============================================================================
// OpenAPI Tags
// ============================================================================

export const googleOpenApiTags = [
  { name: "Google Mail - Messages", description: "Gmail message operations" },
  { name: "Google Mail - Labels", description: "Gmail label operations" },
  { name: "Google Mail - Threads", description: "Gmail thread operations" },
  { name: "Google Mail - Drafts", description: "Gmail draft operations" },
  { name: "Google Calendar - Calendars", description: "Google Calendar calendar list operations" },
  { name: "Google Calendar - Events", description: "Google Calendar event operations" },
  { name: "Google Calendar - Free/Busy", description: "Google Calendar free/busy operations" },
];

// ============================================================================
// Type Exports
// ============================================================================

export type GooglePermission = keyof typeof googlePermissions;
