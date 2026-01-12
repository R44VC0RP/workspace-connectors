/**
 * Google Provider
 *
 * Main entry point for the Google Workspace provider.
 * Registers the provider with all its configuration, services, and routes.
 */

import type { ProviderConfig } from "../core/types";
import { providerRegistry } from "../core/registry";
import {
  googleOAuthConfig,
  googleUIConfig,
  googlePermissions,
  googlePermissionGroups,
  googleScopeToPermissions,
  googleOpenApiTags,
} from "./config";

// Import existing services
import * as gmailService from "@/lib/services/google/gmail";
import * as calendarService from "@/lib/services/google/calendar";

// Import existing routes
import { googleMailRoutes } from "@/lib/api/routes/google/mail";
import { googleCalendarRoutes } from "@/lib/api/routes/google/calendar";

// ============================================================================
// Provider Definition
// ============================================================================

export const googleProvider: ProviderConfig = {
  id: "google",

  ui: googleUIConfig,

  oauth: googleOAuthConfig,

  permissions: googlePermissions,

  permissionGroups: googlePermissionGroups,

  scopeToPermissions: googleScopeToPermissions,

  services: {
    mail: gmailService,
    calendar: calendarService,
  },

  routes: {
    mail: googleMailRoutes,
    calendar: googleCalendarRoutes,
  },

  openApiTags: googleOpenApiTags,
};

// ============================================================================
// Registration
// ============================================================================

// Auto-register when this module is imported
providerRegistry.register(googleProvider);

// ============================================================================
// Exports
// ============================================================================

export * from "./config";
export { gmailService, calendarService };
