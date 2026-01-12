import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, components } from "./_generated/api";

import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes on the Convex HTTP router
authComponent.registerRoutes(http, createAuth);

/**
 * Custom endpoint to verify an API key.
 * This handles API key verification since the plugin endpoint may not be registered.
 */
http.route({
  path: "/api/auth/api-key/verify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { key } = body as { key: string };

      if (!key) {
        return new Response(JSON.stringify({ valid: false, error: { message: "Key is required" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Hash the key using SHA-256 and base64url encoding (matching Better Auth)
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = new Uint8Array(hashBuffer);
      
      // Convert to base64url (no padding, URL-safe characters)
      const base64 = btoa(String.fromCharCode(...hashArray));
      const hashedKey = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      // Look up the API key by hash
      const apiKeyRecord = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "apikey",
        where: [
          { field: "key", operator: "eq", value: hashedKey },
        ],
      }) as {
        _id: string;
        userId: string;
        enabled?: boolean | null;
        expiresAt?: number | null;
        metadata?: string | null;
        permissions?: string | null;
        name?: string | null;
        start?: string | null;
        prefix?: string | null;
      } | null;

      if (!apiKeyRecord) {
        return new Response(JSON.stringify({ valid: false, error: { message: "Invalid API key" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if enabled
      if (apiKeyRecord.enabled === false) {
        return new Response(JSON.stringify({ valid: false, error: { message: "API key is disabled" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check expiration
      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < Date.now()) {
        return new Response(JSON.stringify({ valid: false, error: { message: "API key has expired" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Parse metadata and permissions
      let metadata = null;
      let permissions = null;
      
      try {
        if (apiKeyRecord.metadata) {
          metadata = JSON.parse(apiKeyRecord.metadata);
        }
      } catch {
        // Ignore parse errors
      }

      try {
        if (apiKeyRecord.permissions) {
          permissions = JSON.parse(apiKeyRecord.permissions);
        }
      } catch {
        // Ignore parse errors
      }

      return new Response(JSON.stringify({
        valid: true,
        key: {
          id: apiKeyRecord._id,
          userId: apiKeyRecord.userId,
          name: apiKeyRecord.name,
          start: apiKeyRecord.start,
          prefix: apiKeyRecord.prefix,
          metadata,
          permissions,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error verifying API key:", error);
      return new Response(JSON.stringify({ valid: false, error: { message: "Internal server error" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Custom endpoint to get Google OAuth tokens for a user.
 * This handles token refresh if the access token is expired.
 */
http.route({
  path: "/api/tokens/google",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { userId } = body as { userId: string };

      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get the stored tokens
      const tokens = await ctx.runQuery(internal.tokens.getGoogleTokens, {
        userId,
      });

      if (!tokens) {
        return new Response(JSON.stringify({ error: "No Google account linked" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if access token is expired (with 5 minute buffer)
      const now = Date.now();
      const expiresAt = tokens.accessTokenExpiresAt || 0;
      const isExpired = expiresAt < now + 5 * 60 * 1000; // 5 minute buffer

      if (isExpired && tokens.refreshToken) {
        // Refresh the tokens
        console.log("Access token expired, refreshing...");
        const refreshed = await ctx.runAction(internal.tokens.refreshGoogleTokens, {
          userId,
        });

        if (refreshed) {
          return new Response(JSON.stringify({
            accessToken: refreshed.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: refreshed.expiresAt,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({ error: "Failed to refresh tokens" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Return the current tokens
      return new Response(JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting Google tokens:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Custom endpoint to get Microsoft OAuth tokens for a user.
 * This handles token refresh if the access token is expired.
 */
http.route({
  path: "/api/tokens/microsoft",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { userId } = body as { userId: string };

      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get the stored tokens
      const tokens = await ctx.runQuery(internal.tokens.getMicrosoftTokens, {
        userId,
      });

      if (!tokens) {
        return new Response(JSON.stringify({ error: "No Microsoft account linked" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if access token is expired (with 5 minute buffer)
      const now = Date.now();
      const expiresAt = tokens.accessTokenExpiresAt || 0;
      const isExpired = expiresAt < now + 5 * 60 * 1000; // 5 minute buffer

      if (isExpired && tokens.refreshToken) {
        // Refresh the tokens
        console.log("Microsoft access token expired, refreshing...");
        const refreshed = await ctx.runAction(internal.tokens.refreshMicrosoftTokens, {
          userId,
        });

        if (refreshed) {
          return new Response(JSON.stringify({
            accessToken: refreshed.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: refreshed.expiresAt,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({ error: "Failed to refresh tokens" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Return the current tokens
      return new Response(JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting Microsoft tokens:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
