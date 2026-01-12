/**
 * API Key Permissions System
 * 
 * Defines granular permissions for Google Workspace API access.
 * These permissions are stored in API key metadata and checked on each request.
 */

// All available permissions organized by provider
export const PERMISSIONS = {
  google: {
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
  },
} as const;

// Type for permission keys
export type GooglePermission = keyof typeof PERMISSIONS.google;

// Permission groups for common use cases
export const PERMISSION_GROUPS = {
  // Read-only access to both Gmail and Calendar
  readonly: ["mail:read", "calendar:read"] as GooglePermission[],
  
  // Full Gmail access (read, send, modify, labels, drafts)
  fullGmail: ["mail:read", "mail:send", "mail:modify", "mail:labels", "mail:drafts"] as GooglePermission[],
  
  // Full Calendar access (read, write)
  fullCalendar: ["calendar:read", "calendar:write"] as GooglePermission[],
  
  // Full access to everything
  fullAccess: [
    "mail:read",
    "mail:send",
    "mail:modify",
    "mail:labels",
    "mail:drafts",
    "calendar:read",
    "calendar:write",
  ] as GooglePermission[],
};

// Permissions that require upgraded OAuth scopes (user re-authentication)
export const PERMISSIONS_REQUIRING_REAUTH: GooglePermission[] = [
  "mail:modify",
  "mail:labels",
  "mail:drafts",
];

// OAuth scopes mapped to permissions
export const SCOPE_TO_PERMISSIONS: Record<string, GooglePermission[]> = {
  "https://www.googleapis.com/auth/gmail.readonly": ["mail:read"],
  "https://www.googleapis.com/auth/gmail.send": ["mail:send"],
  "https://www.googleapis.com/auth/gmail.modify": ["mail:modify"],
  "https://www.googleapis.com/auth/gmail.labels": ["mail:labels"],
  "https://www.googleapis.com/auth/gmail.compose": ["mail:drafts"],
  "https://www.googleapis.com/auth/calendar.readonly": ["calendar:read"],
  "https://www.googleapis.com/auth/calendar.events": ["calendar:write"],
};

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(
  permissions: Record<string, string[]>,
  provider: string,
  permission: string
): boolean {
  const providerPerms = permissions[provider] || [];
  return providerPerms.includes(permission);
}

/**
 * Check if any of the requested permissions require re-authentication.
 */
export function requiresReauth(permissions: GooglePermission[]): boolean {
  return permissions.some((p) => PERMISSIONS_REQUIRING_REAUTH.includes(p));
}

/**
 * Get the required OAuth scope for a permission.
 */
export function getRequiredScope(permission: GooglePermission): string {
  const permConfig = PERMISSIONS.google[permission];
  return `https://www.googleapis.com/auth/${permConfig.scope}`;
}

/**
 * Get all permissions that a user can use based on their granted OAuth scopes.
 */
export function getAvailablePermissions(grantedScopes: string[]): GooglePermission[] {
  const available: GooglePermission[] = [];
  
  for (const [scope, perms] of Object.entries(SCOPE_TO_PERMISSIONS)) {
    if (grantedScopes.includes(scope)) {
      available.push(...perms);
    }
  }
  
  return [...new Set(available)];
}

/**
 * Validate that a user has the required OAuth scopes for the requested permissions.
 */
export function validatePermissionsAgainstScopes(
  requestedPermissions: GooglePermission[],
  grantedScopes: string[]
): { valid: boolean; missingScopes: string[] } {
  const missingScopes: string[] = [];
  
  for (const permission of requestedPermissions) {
    const requiredScope = getRequiredScope(permission);
    if (!grantedScopes.includes(requiredScope)) {
      missingScopes.push(requiredScope);
    }
  }
  
  return {
    valid: missingScopes.length === 0,
    missingScopes: [...new Set(missingScopes)],
  };
}
