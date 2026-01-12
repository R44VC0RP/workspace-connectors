/**
 * Google Provider
 *
 * Main entry point for the Google Workspace provider.
 * Registers the provider with all its configuration and services.
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

// Note: Routes are imported directly in lib/api/index.ts to avoid circular dependencies

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
    // Routes are mounted explicitly in lib/api/index.ts
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
