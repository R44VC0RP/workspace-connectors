import { Autumn } from "autumn-js";

/**
 * Autumn billing client for API usage tracking
 *
 * Plan: workspace_connector
 * Feature: workspace_connector_access
 */
const autumn = new Autumn({
  secretKey: process.env.AUTUMN_SECRET_KEY!,
});

// Feature ID for workspace connector access
export const FEATURE_ID = "workspace_connector_access";

/**
 * Check if a customer has access to the workspace connector feature
 * @param customerId - The user ID (from API key)
 * @returns Whether the customer is allowed to use the feature
 */
export async function checkAccess(customerId: string): Promise<{
  allowed: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await autumn.check({
      customer_id: customerId,
      feature_id: FEATURE_ID,
    });

    if (error) {
      console.error("Autumn check error:", error);
      return { allowed: false, error: error.message };
    }

    return { allowed: data?.allowed ?? false };
  } catch (err) {
    console.error("Autumn check failed:", err);
    // Fail open for now - allow access if billing check fails
    // Change to false in production if you want to fail closed
    return { allowed: true };
  }
}

/**
 * Track API usage for a customer
 * @param customerId - The user ID (from API key)
 * @param value - Number of API calls to track (default: 1)
 */
export async function trackUsage(
  customerId: string,
  value: number = 1
): Promise<void> {
  try {
    const { error } = await autumn.track({
      customer_id: customerId,
      feature_id: FEATURE_ID,
      value,
    });

    if (error) {
      console.error("Autumn track error:", error);
    }
  } catch (err) {
    console.error("Autumn track failed:", err);
    // Don't throw - tracking failures shouldn't block API requests
  }
}

/**
 * Create or get a customer in Autumn
 * Called when a user signs up
 */
export async function ensureCustomer(
  customerId: string,
  name?: string,
  email?: string
): Promise<void> {
  try {
    await autumn.customers.create({
      id: customerId,
      name: name || undefined,
      email: email || undefined,
    });
  } catch {
    // Customer may already exist, that's okay
    console.log("Customer already exists or creation skipped:", customerId);
  }
}
