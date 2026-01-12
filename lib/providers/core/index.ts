/**
 * Provider Core - Public API
 *
 * Re-exports all types and utilities for provider development.
 */

// Types
export type {
  // Permission types
  PermissionDefinition,
  PermissionGroup,
  
  // Mail types
  MailMessageListOptions,
  MailMessageSummary,
  MailMessageDetail,
  MailMessageListResult,
  MailSendOptions,
  MailSendResult,
  MailLabel,
  MailLabelListResult,
  MailThread,
  MailThreadListResult,
  
  // Calendar types
  CalendarListOptions,
  CalendarSummary,
  CalendarListResult,
  CalendarEventListOptions,
  CalendarEventAttendee,
  CalendarEvent,
  CalendarEventListResult,
  CalendarEventCreateOptions,
  FreeBusyOptions,
  FreeBusyResult,
  
  // Service types
  ServiceModule,
  
  // OAuth types
  OAuthConfig,
  OAuthTokens,
  
  // Provider types
  ProviderUIConfig,
  ProviderConfig,
  ProviderId,
  ProviderRegistry,
} from "./types";

// Registry
export {
  providerRegistry,
  getAllPermissions,
  getAllPermissionGroups,
  getAllScopeToPermissions,
  getAllOpenApiTags,
  getAllOpenApiTagGroups,
  getAllRoutes,
  getProviderUIConfigs,
  hasPermission,
  getRequiredScope,
  requiresReauth,
} from "./registry";
