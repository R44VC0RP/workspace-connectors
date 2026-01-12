/**
 * Convex functions for retrieving and refreshing OAuth tokens.
 * These are used by the API routes to make authenticated requests to Google APIs.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal, components } from "./_generated/api";

interface GoogleTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  scope: string | null;
}

interface AccountRecord {
  _id: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: number | null;
  scope?: string | null;
}

/**
 * Get Google OAuth tokens for a user.
 * Returns the access token, refresh token, and expiration time.
 */
export const getGoogleTokens = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<GoogleTokens | null> => {
    // Query the account table for the user's Google account
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: args.userId },
        { field: "providerId", operator: "eq", value: "google", connector: "AND" },
      ],
    }) as AccountRecord | null;

    if (!account) {
      return null;
    }

    return {
      accessToken: account.accessToken ?? null,
      refreshToken: account.refreshToken ?? null,
      accessTokenExpiresAt: account.accessTokenExpiresAt ?? null,
      scope: account.scope ?? null,
    };
  },
});

/**
 * Update stored tokens after a refresh.
 */
export const updateGoogleTokens = internalMutation({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the account first
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: args.userId },
        { field: "providerId", operator: "eq", value: "google", connector: "AND" },
      ],
    }) as AccountRecord | null;

    if (!account || !account._id) {
      throw new Error("Google account not found for user");
    }

    // Update the tokens using updateOne
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "account",
        update: {
          accessToken: args.accessToken,
          accessTokenExpiresAt: args.accessTokenExpiresAt,
          updatedAt: Date.now(),
        },
        where: [
          { field: "_id", operator: "eq", value: account._id },
        ],
      },
    });
  },
});

/**
 * Refresh Google OAuth tokens using the refresh token.
 * This action calls Google's token endpoint to get new tokens.
 */
export const refreshGoogleTokens = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{ accessToken: string; expiresAt: number } | null> => {
    // Get the current tokens
    const tokens = await ctx.runQuery(internal.tokens.getGoogleTokens, {
      userId: args.userId,
    });

    if (!tokens?.refreshToken) {
      console.error("No refresh token available for user:", args.userId);
      return null;
    }

    // Call Google's token endpoint
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Google OAuth credentials not configured");
      return null;
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to refresh Google tokens:", error);
        return null;
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      const expiresAt = Date.now() + (data.expires_in * 1000);

      // Update the stored tokens
      await ctx.runMutation(internal.tokens.updateGoogleTokens, {
        userId: args.userId,
        accessToken: data.access_token,
        accessTokenExpiresAt: expiresAt,
      });

      return {
        accessToken: data.access_token,
        expiresAt,
      };
    } catch (error) {
      console.error("Error refreshing Google tokens:", error);
      return null;
    }
  },
});
