/**
 * API Key verification and token retrieval for the public API.
 * This module bridges Elysia API routes with Better Auth + Convex.
 */

// Re-export hasPermission from permissions module for backwards compatibility
export { hasPermission } from "./permissions";

interface ApiKeyData {
  id: string;
  userId: string;
  permissions: Record<string, string[]>;
}

interface UserTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

interface VerifyResult {
  valid: boolean;
  data?: ApiKeyData;
  tokens?: UserTokens;
  error?: string;
}

/**
 * Verify an API key by calling the Better Auth verify endpoint.
 * This is called from the Elysia middleware on each API request.
 */
export async function verifyApiKey(
  apiKey: string,
  requiredPermissions?: Record<string, string[]>
): Promise<VerifyResult> {
  try {
    
    // Call Better Auth's verify endpoint via the Convex site URL
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      console.error("NEXT_PUBLIC_CONVEX_SITE_URL not configured");
      return { valid: false, error: "Server configuration error" };
    }

    const response = await fetch(`${convexSiteUrl}/api/auth/api-key/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: apiKey,
        permissions: requiredPermissions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[verifyApiKey] API key verification failed:", response.status, error);
      return { valid: false, error: "Invalid API key" };
    }

    const result = await response.json();

    if (!result.valid || !result.key) {
      return {
        valid: false,
        error: result.error?.message || "Invalid API key",
      };
    }

    // Permissions can be stored in metadata (client-created keys) or directly on the key (server-created)
    // Note: metadata may be stored as a JSON string in Convex, so we need to parse it
    let metadata = result.key.metadata;
    if (typeof metadata === "string") {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        metadata = {};
      }
    }
    const permissions = metadata?.permissions || result.key.permissions || {};

    return {
      valid: true,
      data: {
        id: result.key.id,
        userId: result.key.userId,
        permissions,
      },
    };
  } catch (error) {
    console.error("API key verification error:", error);
    return { valid: false, error: "Verification failed" };
  }
}

/**
 * Get OAuth tokens for a user's linked Google account.
 * This queries Convex directly to get the stored tokens.
 * If tokens are expired, it will attempt to refresh them.
 */
export async function getUserGoogleTokens(
  userId: string
): Promise<UserTokens | null> {
  try {
    
    // Query Convex for the user's Google tokens
    // Note: We need to use an action since internal queries can't be called from outside Convex
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      console.error("NEXT_PUBLIC_CONVEX_SITE_URL not configured");
      return null;
    }

    // Call our custom HTTP endpoint to get tokens
    const response = await fetch(`${convexSiteUrl}/api/tokens/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[getUserGoogleTokens] Failed to get user tokens:", response.status, errorText);
      return null;
    }

    const data = await response.json();

    if (!data.accessToken) {
      console.error("[getUserGoogleTokens] No access token in response");
      return null;
    }

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      expiresAt: data.accessTokenExpiresAt || null,
    };
  } catch (error) {
    console.error("Get user tokens error:", error);
    return null;
  }
}


