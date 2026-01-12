/**
 * Convex functions for retrieving and refreshing OAuth tokens.
 * These are used by the API routes to make authenticated requests to Google APIs.
 */

import { v } from "convex/values";
import { query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { authComponent } from "./auth";

// OAuth scopes that were added after initial launch (require re-authentication)
const UPGRADED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.compose",
];

interface OAuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  scope: string | null;
}

// Legacy alias for backwards compatibility
type GoogleTokens = OAuthTokens;

interface AccountRecord {
  _id: string;
  providerId?: string;
  accountId?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: number | null;
  scope?: string | null;
}

interface LinkedAccount {
  provider: "google" | "microsoft";
  accountId: string;
  connectedAt?: number;
}

/**
 * Get linked accounts for the current authenticated user.
 * Returns a list of connected providers (google, microsoft).
 */
export const getLinkedAccounts = query({
  args: {},
  handler: async (ctx): Promise<LinkedAccount[]> => {
    let user;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return [];
    }
    
    if (!user) {
      return [];
    }

    // Get all accounts for this user
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: user._id },
      ],
      paginationOpts: { numItems: 10, cursor: null },
    });
    const accounts = result.page as AccountRecord[];

    return accounts
      .filter((acc) => acc.providerId === "google" || acc.providerId === "microsoft")
      .map((acc) => ({
        provider: acc.providerId as "google" | "microsoft",
        accountId: acc.accountId || acc._id,
      }));
  },
});

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
 * Get Microsoft OAuth tokens for a user.
 * Returns the access token, refresh token, and expiration time.
 */
export const getMicrosoftTokens = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<OAuthTokens | null> => {
    // Query the account table for the user's Microsoft account
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: args.userId },
        { field: "providerId", operator: "eq", value: "microsoft", connector: "AND" },
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
 * Update stored Microsoft tokens after a refresh.
 */
export const updateMicrosoftTokens = internalMutation({
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
        { field: "providerId", operator: "eq", value: "microsoft", connector: "AND" },
      ],
    }) as AccountRecord | null;

    if (!account || !account._id) {
      throw new Error("Microsoft account not found for user");
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
 * Check if the current user needs to re-authenticate to get upgraded OAuth scopes.
 * Returns true if user is logged in but doesn't have the new scopes.
 * 
 * NOTE: Currently disabled because Better Auth doesn't store OAuth scopes.
 * Always returns false to allow all permissions.
 * TODO: Implement scope storage in Better Auth config to enable this check.
 */
export const needsReauthentication = query({
  args: {},
  handler: async (_ctx): Promise<boolean> => {
    // Scope verification is disabled until we can properly store OAuth scopes
    // All permissions are available to authenticated users
    return false;
    
    // Original implementation (for reference):
    // Get the authenticated user - wrap in try/catch to handle unauthenticated state
    /*
    let user;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return false;
    }
    
    if (!user) {
      return false;
    }

    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: user._id },
        { field: "providerId", operator: "eq", value: "google", connector: "AND" },
      ],
    }) as AccountRecord | null;

    if (!account?.scope) {
      return false;
    }

    const userScopes = account.scope.split(" ");
    const hasAllUpgradedScopes = UPGRADED_SCOPES.every((scope) =>
      userScopes.includes(scope)
    );

    return !hasAllUpgradedScopes;
    */
  },
});

/**
 * Debug query to see what scopes are stored for the current user.
 * Use this in the Convex dashboard to debug scope issues.
 */
export const debugUserScopes = query({
  args: {},
  handler: async (ctx): Promise<{ userId: string | null; scopes: string | null; hasUpgradedScopes: boolean; missingScopes: string[] } | null> => {
    let user;
    try {
      user = await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    
    if (!user) {
      return null;
    }

    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: user._id },
        { field: "providerId", operator: "eq", value: "google", connector: "AND" },
      ],
    }) as AccountRecord | null;

    const scopes = account?.scope || null;
    const userScopes = scopes ? scopes.split(" ") : [];
    const missingScopes = UPGRADED_SCOPES.filter((scope) => !userScopes.includes(scope));

    return {
      userId: user._id,
      scopes,
      hasUpgradedScopes: missingScopes.length === 0,
      missingScopes,
    };
  },
});

/**
 * Debug query that takes userId as argument - for use in Convex dashboard.
 */
export const debugUserScopesById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{ userId: string; scopes: string | null; hasUpgradedScopes: boolean; missingScopes: string[] }> => {
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: args.userId },
        { field: "providerId", operator: "eq", value: "google", connector: "AND" },
      ],
    }) as AccountRecord | null;

    const scopes = account?.scope || null;
    const userScopes = scopes ? scopes.split(" ") : [];
    const missingScopes = UPGRADED_SCOPES.filter((scope) => !userScopes.includes(scope));

    return {
      userId: args.userId,
      scopes,
      hasUpgradedScopes: missingScopes.length === 0,
      missingScopes,
    };
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

/**
 * Refresh Microsoft OAuth tokens using the refresh token.
 * This action calls Microsoft's token endpoint to get new tokens.
 */
export const refreshMicrosoftTokens = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{ accessToken: string; expiresAt: number } | null> => {
    // Get the current tokens
    const tokens = await ctx.runQuery(internal.tokens.getMicrosoftTokens, {
      userId: args.userId,
    });

    if (!tokens?.refreshToken) {
      console.error("No Microsoft refresh token available for user:", args.userId);
      return null;
    }

    // Call Microsoft's token endpoint
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Microsoft OAuth credentials not configured");
      return null;
    }

    try {
      const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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
        console.error("Failed to refresh Microsoft tokens:", error);
        return null;
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      const expiresAt = Date.now() + (data.expires_in * 1000);

      // Update the stored tokens
      await ctx.runMutation(internal.tokens.updateMicrosoftTokens, {
        userId: args.userId,
        accessToken: data.access_token,
        accessTokenExpiresAt: expiresAt,
      });

      return {
        accessToken: data.access_token,
        expiresAt,
      };
    } catch (error) {
      console.error("Error refreshing Microsoft tokens:", error);
      return null;
    }
  },
});
