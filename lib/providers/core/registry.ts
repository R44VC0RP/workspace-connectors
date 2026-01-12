/**
 * Provider Registry
 *
 * Central registry for all workspace connector providers.
 * Handles registration, lookup, and aggregation of provider configurations.
 */

import type {
  ProviderConfig,
  ProviderId,
  ProviderRegistry,
  PermissionDefinition,
} from "./types";

// ============================================================================
// Registry Implementation
// ============================================================================

class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<ProviderId, ProviderConfig>();

  /**
   * Register a new provider
   */
  register(provider: ProviderConfig): void {
    if (this.providers.has(provider.id)) {
      console.warn(`Provider "${provider.id}" is already registered. Overwriting.`);
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by ID
   */
  get(id: ProviderId): ProviderConfig | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   */
  getAll(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all registered provider IDs
   */
  getIds(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistryImpl();

// ============================================================================
// Registry Helper Functions
// ============================================================================

/**
 * Get aggregated permissions from all providers
 */
export function getAllPermissions(): Record<ProviderId, Record<string, PermissionDefinition>> {
  const result: Record<ProviderId, Record<string, PermissionDefinition>> = {};

  for (const provider of providerRegistry.getAll()) {
    result[provider.id] = provider.permissions;
  }

  return result;
}

/**
 * Get aggregated permission groups from all providers
 */
export function getAllPermissionGroups(): Record<ProviderId, Record<string, string[]>> {
  const result: Record<ProviderId, Record<string, string[]>> = {};

  for (const provider of providerRegistry.getAll()) {
    result[provider.id] = provider.permissionGroups;
  }

  return result;
}

/**
 * Get scope to permission mapping from all providers
 */
export function getAllScopeToPermissions(): Record<ProviderId, Record<string, string[]>> {
  const result: Record<ProviderId, Record<string, string[]>> = {};

  for (const provider of providerRegistry.getAll()) {
    result[provider.id] = provider.scopeToPermissions;
  }

  return result;
}

/**
 * Get all OpenAPI tags from all providers
 */
export function getAllOpenApiTags(): Array<{ name: string; description: string }> {
  const tags: Array<{ name: string; description: string }> = [
    { name: "System", description: "Health and status endpoints" },
  ];

  for (const provider of providerRegistry.getAll()) {
    tags.push(...provider.openApiTags);
  }

  return tags;
}

/**
 * Get all OpenAPI tag groups organized by provider
 */
export function getAllOpenApiTagGroups(): Array<{ name: string; tags: string[] }> {
  const groups: Array<{ name: string; tags: string[] }> = [
    { name: "System", tags: ["System"] },
  ];

  for (const provider of providerRegistry.getAll()) {
    groups.push({
      name: provider.ui.name,
      tags: provider.openApiTags.map((t) => t.name),
    });
  }

  return groups;
}

/**
 * Get all routes from all providers to mount
 * Returns routes as unknown[] since Elysia's complex generic types vary per configuration
 */
export function getAllRoutes(): unknown[] {
  const routes: unknown[] = [];

  for (const provider of providerRegistry.getAll()) {
    if (provider.routes.mail) {
      routes.push(provider.routes.mail);
    }
    if (provider.routes.calendar) {
      routes.push(provider.routes.calendar);
    }
  }

  return routes;
}

/**
 * Get UI configuration for all providers (for linked-accounts component)
 */
export function getProviderUIConfigs(): Array<{
  id: ProviderId;
  name: string;
  description: string;
  icon: string;
}> {
  return providerRegistry.getAll().map((provider) => ({
    id: provider.id,
    name: provider.ui.name,
    description: provider.ui.description,
    icon: provider.ui.icon,
  }));
}

/**
 * Check if a user has a specific permission for a provider
 */
export function hasPermission(
  permissions: Record<string, string[]>,
  providerId: string,
  permission: string
): boolean {
  const providerPerms = permissions[providerId] || [];
  return providerPerms.includes(permission);
}

/**
 * Get the OAuth scope required for a permission
 */
export function getRequiredScope(providerId: string, permission: string): string | undefined {
  const provider = providerRegistry.get(providerId);
  if (!provider) return undefined;

  const permConfig = provider.permissions[permission];
  return permConfig?.scope;
}

/**
 * Check if any permissions require re-authentication
 */
export function requiresReauth(providerId: string, permissions: string[]): boolean {
  const provider = providerRegistry.get(providerId);
  if (!provider) return false;

  return permissions.some((p) => provider.permissions[p]?.requiresReauth);
}
