import type { GenericQueryCtx } from "convex/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { Autumn } from "@useautumn/convex";
import { authComponent } from "./auth";

/**
 * Autumn billing client for Workspace Connectors
 *
 * Plan: workspace_connector
 * Feature: workspace_connector_access
 */
export const autumn = new Autumn(components.autumn, {
  secretKey: process.env.AUTUMN_SECRET_KEY!,
  // Using Better Auth for identification
  identify: async (ctx: GenericQueryCtx<DataModel>) => {
    try {
      // Use Better Auth's getAuthUser to get the authenticated user
      const user = await authComponent.getAuthUser(ctx);
      if (!user) return null;

      // Better Auth returns the user document directly with _id as the user ID
      return {
        customerId: user._id,
        customerData: {
          name: user.name || undefined,
          email: user.email,
        },
      };
    } catch {
      // User is not authenticated
      return null;
    }
  },
});

/**
 * Export all Autumn API functions for use in frontend and backend
 */
export const {
  track,
  cancel,
  query,
  attach,
  check,
  checkout,
  usage,
  setupPayment,
  createCustomer,
  listProducts,
  billingPortal,
  createReferralCode,
  redeemReferralCode,
  createEntity,
  getEntity,
} = autumn.api();
