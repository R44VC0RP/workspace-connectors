"use client";

import { useCustomer, CheckoutDialog } from "autumn-js/react";
import { IconLock, IconCheck } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PLAN_ID = "workspace_connector";
const FEATURE_ID = "workspace_connector_access";

const features = [
  "Connect Gmail and Google Calendar",
  "Generate scoped API keys",
  "100 API requests per minute",
  "Zero data retention",
  "OpenAPI documentation",
];

export function Paywall() {
  const { checkout, isLoading } = useCustomer();

  const handleUpgrade = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    
    await checkout({
      productId: PLAN_ID,
      dialog: CheckoutDialog,
      successUrl: `${baseUrl}/dashboard`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <IconLock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Upgrade to Access</CardTitle>
          <CardDescription>
            Subscribe to Workspace Connectors to access the dashboard and API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm">
                <IconCheck className="h-4 w-4 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button
            className="w-full"
            size="lg"
            onClick={handleUpgrade}
            disabled={isLoading}
          >
            Subscribe Now
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Powered by Stripe. Cancel anytime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Inner hook that uses Autumn - only call when AutumnProvider is available
 */
function useHasAccessInner(): { hasAccess: boolean; isLoading: boolean } {
  const { customer, isLoading } = useCustomer();

  if (isLoading || !customer) {
    return { hasAccess: false, isLoading: true };
  }

  // Check if user has the workspace_connector product
  const hasProduct = customer.products?.some(
    (product: { id: string; status: string }) => product.id === PLAN_ID && product.status === "active"
  );

  // Or check if they have access to the feature
  const featureData = customer.features?.[FEATURE_ID];
  const hasFeature = (featureData?.balance ?? 0) > 0 || featureData?.unlimited;

  return { hasAccess: hasProduct || hasFeature || false, isLoading: false };
}

// Re-export for use in dashboard layout
export { useHasAccessInner as useHasAccess };
