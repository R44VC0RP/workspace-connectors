"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconKey, IconLink, IconLayoutDashboard } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: IconLayoutDashboard },
  { name: "Connected Accounts", href: "/dashboard/accounts", icon: IconLink },
  { name: "API Keys", href: "/dashboard/api-keys", icon: IconKey },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen justify-center">
        <div className="w-full max-w-3xl px-6 py-16">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex min-h-screen justify-center">
      <div className="w-full max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <Link href="/dashboard" className="text-xl font-semibold">
            Workspace Connectors
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 border-b py-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <main className="py-8">{children}</main>
      </div>
    </div>
  );
}
