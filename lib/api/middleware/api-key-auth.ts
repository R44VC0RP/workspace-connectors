import { Elysia } from "elysia";

import {
  verifyApiKey as verifyApiKeyAuth,
  getUserGoogleTokens,
} from "@/lib/api/auth";

interface ApiKeyData {
  id: string;
  userId: string;
  permissions: Record<string, string[]>;
}

interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

/**
 * Verify an API key and return the key data if valid.
 */
async function verifyApiKey(key: string): Promise<ApiKeyData | null> {
  if (!key || !key.startsWith("wsc_")) {
    return null;
  }

  const result = await verifyApiKeyAuth(key);

  if (!result.valid || !result.data) {
    return null;
  }

  return result.data;
}

export const apiKeyAuth = new Elysia({ name: "api-key-auth" })
  .derive(async ({ headers, set }) => {
    const apiKeyHeader =
      headers["x-api-key"] || headers["authorization"]?.replace("Bearer ", "");

    if (!apiKeyHeader) {
      return {
        apiKey: null,
        apiKeyData: null,
        userId: null,
        googleTokens: null,
      };
    }

    const keyData = await verifyApiKey(apiKeyHeader);

    // If we have valid API key data, also fetch Google tokens
    let googleTokens: GoogleTokens | null = null;
    if (keyData?.userId) {
      googleTokens = await getUserGoogleTokens(keyData.userId);
    }

    return {
      apiKey: apiKeyHeader,
      apiKeyData: keyData,
      userId: keyData?.userId ?? null,
      googleTokens,
    };
  })
  .macro({
    // Use as: requireApiKey: true
    requireApiKey: {
      beforeHandle({ apiKeyData, set }) {
        if (!apiKeyData) {
          set.status = 401;
          return {
            error: "unauthorized",
            message: "Valid API key required. Include X-API-Key header.",
          };
        }
      },
    },
    // Use as: requirePermission: { provider: "google", permission: "mail:read" }
    requirePermission: (opts: { provider: string; permission: string }) => ({
      beforeHandle({ apiKeyData, set }) {
        if (!apiKeyData) {
          set.status = 401;
          return {
            error: "unauthorized",
            message: "Valid API key required",
          };
        }

        const providerPerms = apiKeyData.permissions[opts.provider] || [];
        if (!providerPerms.includes(opts.permission)) {
          set.status = 403;
          return {
            error: "forbidden",
            message: `Missing permission: ${opts.provider}:${opts.permission}`,
          };
        }
      },
    }),
  });
