import { betterAuth } from "better-auth";
import { apiKey } from "better-auth/plugins";

import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";

import { components } from "./_generated/api";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

import type { DataModel } from "./_generated/dataModel";
import type { GenericCtx } from "@convex-dev/better-auth";

const siteUrl = process.env.SITE_URL!;

// Google OAuth scopes for Gmail and Calendar access
// Note: When adding new scopes, existing users need to re-authenticate
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Gmail scopes
  "https://www.googleapis.com/auth/gmail.readonly",   // Read emails, labels, threads
  "https://www.googleapis.com/auth/gmail.send",       // Send emails
  "https://www.googleapis.com/auth/gmail.modify",     // Trash/untrash, modify labels on messages
  "https://www.googleapis.com/auth/gmail.labels",     // Create/delete labels
  "https://www.googleapis.com/auth/gmail.compose",    // Create/update/delete drafts
  // Calendar scopes
  "https://www.googleapis.com/auth/calendar.readonly", // Read calendars and events
  "https://www.googleapis.com/auth/calendar.events",   // Create/update/delete events
];

// Scopes that require user re-authentication (added after initial launch)
export const UPGRADED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.compose",
];

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Google OAuth with Gmail and Calendar scopes
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: GOOGLE_SCOPES,
        // Always get refresh token for API access
        accessType: "offline",
        prompt: "consent",
      },
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      // API Key plugin for programmatic access
      apiKey({
        // Custom prefix for API keys
        defaultKeyLength: 32,
        // API key headers to check
        apiKeyHeaders: ["x-api-key", "authorization"],
        // Enable metadata for storing additional info
        enableMetadata: true,
        // Require a name for API keys
        requireName: true,
        // Key expiration settings
        keyExpiration: {
          defaultExpiresIn: 365, // days
          disableCustomExpiresTime: false,
        },
        // Rate limiting (built-in, can switch to Upstash later)
        rateLimit: {
          enabled: true,
          timeWindow: 60 * 1000, // 1 minute
          maxRequests: 100,
        },
      }),
    ],
  });
};

// Query to get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
