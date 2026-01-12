/**
 * Workspace Connectors - Provider Registry
 *
 * This is the main entry point for the provider system.
 * Import this module to auto-register all providers.
 *
 * ## Adding a New Provider
 *
 * To add a new provider (e.g., Slack):
 *
 * 1. Create the provider directory:
 *    ```
 *    lib/providers/slack/
 *    ├── config.ts    # OAuth, permissions, UI config
 *    └── index.ts     # Provider definition & registration
 *    ```
 *
 * 2. In config.ts, define:
 *    - OAuth configuration (scopes, endpoints)
 *    - UI configuration (name, description, icon)
 *    - Permissions (what the provider can do)
 *    - Permission groups (common permission bundles)
 *    - OpenAPI tags (for documentation)
 *
 * 3. In index.ts:
 *    - Import your services and routes
 *    - Create the ProviderConfig object
 *    - Call providerRegistry.register(yourProvider)
 *
 * 4. Add import to this file:
 *    ```
 *    import "./slack";
 *    ```
 *
 * That's it! The provider will be automatically:
 * - Added to the permissions system
 * - Mounted in the API routes
 * - Shown in OpenAPI documentation
 * - Available in the linked accounts UI
 */

// Re-export core types and utilities
export * from "./core";

// ============================================================================
// Provider Registration
// ============================================================================
// Import each provider to trigger auto-registration
// Add new providers here as they are created

import "./google";
import "./microsoft";

// Future providers:
// import "./slack";
// import "./notion";
// import "./zoom";

// ============================================================================
// Convenience Re-exports
// ============================================================================

export { googleProvider } from "./google";
export { microsoftProvider } from "./microsoft";
