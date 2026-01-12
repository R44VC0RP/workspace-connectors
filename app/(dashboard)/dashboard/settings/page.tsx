"use client";

import { useCustomer } from "autumn-js/react";
import { IconUser, IconCreditCard, IconCalendar } from "@tabler/icons-react";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { customer, openBillingPortal, isLoading } = useCustomer();

  const handleManageBilling = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    await openBillingPortal({
      returnUrl: `${baseUrl}/dashboard/settings`,
    });
  };

  // Get active product/plan info
  const activeProduct = customer?.products?.find(
    (p: { status: string }) => p.status === "active"
  );

  // Format date
  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and billing
        </p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUser className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-sm">{session?.user?.name || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{session?.user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">User ID</p>
              <p className="text-sm font-mono text-xs">{session?.user?.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCreditCard className="h-5 w-5" />
            Billing
          </CardTitle>
          <CardDescription>Your subscription and billing details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading billing info...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <p className="text-sm">
                    {activeProduct?.name || "No active plan"}
                    {activeProduct?.status === "active" && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-sm capitalize">{activeProduct?.status || "N/A"}</p>
                </div>
                {activeProduct?.current_period_start && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      <IconCalendar className="mr-1 inline h-3 w-3" />
                      Current Period Start
                    </p>
                    <p className="text-sm">{formatDate(activeProduct.current_period_start)}</p>
                  </div>
                )}
                {activeProduct?.current_period_end && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      <IconCalendar className="mr-1 inline h-3 w-3" />
                      Next Billing Date
                    </p>
                    <p className="text-sm">{formatDate(activeProduct.current_period_end)}</p>
                  </div>
                )}
              </div>

              {/* Usage Info */}
              {customer?.features && Object.keys(customer.features).length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Features</p>
                  <div className="space-y-2">
                    {Object.entries(customer.features).map(([featureId, feature]) => {
                      // Check if it's a boolean/static feature (no usage tracking)
                      const isBoolean = feature.type === "static" || 
                        (feature.unlimited && feature.usage === undefined);
                      
                      return (
                        <div key={featureId} className="flex items-center justify-between text-sm">
                          <span>{feature.name || featureId}</span>
                          <span className="text-muted-foreground">
                            {isBoolean ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                                Active
                              </span>
                            ) : feature.unlimited ? (
                              "Unlimited"
                            ) : (
                              `${feature.usage ?? 0} / ${feature.included_usage ?? feature.balance ?? "∞"}`
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <Button onClick={handleManageBilling} variant="outline">
                  Manage Billing
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Update payment method, view invoices, or cancel subscription
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
