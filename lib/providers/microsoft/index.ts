/**
 * Microsoft Provider
 *
 * Main entry point for the Microsoft 365 provider.
 * Registers the provider with all its configuration, services, and routes.
 */

import type { ProviderConfig } from "../core/types";
import { providerRegistry } from "../core/registry";
import {
  microsoftOAuthConfig,
  microsoftUIConfig,
  microsoftPermissions,
  microsoftPermissionGroups,
  microsoftScopeToPermissions,
  microsoftOpenApiTags,
} from "./config";

// Import existing services
import * as outlookService from "@/lib/services/microsoft/outlook";
import * as calendarService from "@/lib/services/microsoft/calendar";

// Import existing routes
import { microsoftMailRoutes } from "@/lib/api/routes/microsoft/mail";
import { microsoftCalendarRoutes } from "@/lib/api/routes/microsoft/calendar";

// ============================================================================
// Provider Definition
// ============================================================================

export const microsoftProvider: ProviderConfig = {
  id: "microsoft",

  ui: microsoftUIConfig,

  oauth: microsoftOAuthConfig,

  permissions: microsoftPermissions,

  permissionGroups: microsoftPermissionGroups,

  scopeToPermissions: microsoftScopeToPermissions,

  services: {
    mail: outlookService,
    calendar: calendarService,
  },

  routes: {
    mail: microsoftMailRoutes,
    calendar: microsoftCalendarRoutes,
  },

  openApiTags: microsoftOpenApiTags,
};

// ============================================================================
// Registration
// ============================================================================

// Auto-register when this module is imported
providerRegistry.register(microsoftProvider);

// ============================================================================
// Exports
// ============================================================================

export * from "./config";
export { outlookService, calendarService };
