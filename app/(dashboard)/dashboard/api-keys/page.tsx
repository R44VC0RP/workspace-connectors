"use client";

import { useEffect, useState } from "react";
import {
  IconPlus,
  IconTrash,
  IconCopy,
  IconCheck,
  IconKey,
} from "@tabler/icons-react";

import { apiKey } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Available permission scopes
const AVAILABLE_SCOPES = {
  google: [
    { id: "mail:read", label: "Read emails", description: "Read Gmail messages" },
    { id: "mail:send", label: "Send emails", description: "Send emails via Gmail" },
    { id: "calendar:read", label: "Read calendar", description: "Read calendar events" },
    { id: "calendar:write", label: "Write calendar", description: "Create/update/delete events" },
  ],
};

interface ApiKeyData {
  id: string;
  name: string;
  start: string;
  createdAt: Date;
  expiresAt: Date | null;
  permissions: Record<string, string[]> | null;
  metadata: { permissions?: Record<string, string[]> } | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch keys on mount
  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const result = await apiKey.list();
      if (result.data) {
        setKeys(result.data as unknown as ApiKeyData[]);
      }
    } catch (error) {
      console.error("Failed to fetch keys:", error);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setIsLoading(true);
    try {
      // Convert selected scopes to permissions format
      // Scopes are formatted as "provider:permission" where permission can contain ":"
      // e.g., "google:mail:read" -> provider="google", permission="mail:read"
      const permissions: Record<string, string[]> = {};
      selectedScopes.forEach((scope) => {
        const colonIndex = scope.indexOf(":");
        const provider = scope.slice(0, colonIndex);
        const permission = scope.slice(colonIndex + 1);
        if (!permissions[provider]) {
          permissions[provider] = [];
        }
        permissions[provider].push(permission);
      });

      console.log("Creating key with:", { name: newKeyName, prefix: "wsc", permissions, expiresIn: 365 * 24 * 60 * 60 });
      
      // Note: permissions is a server-only property in Better Auth, so we store it in metadata
      const result = await apiKey.create({
        name: newKeyName,
        prefix: "wsc",
        metadata: { permissions },
        expiresIn: 365 * 24 * 60 * 60, // 1 year in seconds
      });

      console.log("Create result:", result);

      if (result.error) {
        console.error("API Key create error:", result.error);
        alert(`Error: ${result.error.message || JSON.stringify(result.error)}`);
      } else if (result.data?.key) {
        setCreatedKey(result.data.key);
        await fetchKeys();
      }
    } catch (error) {
      console.error("Failed to create key:", error);
      alert(`Error creating key: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await apiKey.delete({ keyId });
      await fetchKeys();
    } catch (error) {
      console.error("Failed to delete key:", error);
    }
  };

  const handleCopyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setNewKeyName("");
    setSelectedScopes([]);
    setCreatedKey(null);
    setCopied(false);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage API keys for programmatic access.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            {createdKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Copy your API key now. You won&apos;t be able to see it again.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={createdKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyKey}
                    >
                      {copied ? (
                        <IconCheck className="h-4 w-4" />
                      ) : (
                        <IconCopy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseCreate}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key with specific permissions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      placeholder="Production API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Permissions</Label>
                    {Object.entries(AVAILABLE_SCOPES).map(([provider, scopes]) => (
                      <div key={provider} className="space-y-2">
                        <p className="text-sm font-medium capitalize">{provider}</p>
                        <div className="space-y-2 pl-2">
                          {scopes.map((scope) => {
                            const scopeId = `${provider}:${scope.id}`;
                            return (
                              <div
                                key={scopeId}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={scopeId}
                                  checked={selectedScopes.includes(scopeId)}
                                  onCheckedChange={() => toggleScope(scopeId)}
                                />
                                <label
                                  htmlFor={scopeId}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {scope.label}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {scope.description}
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreate}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim() || selectedScopes.length === 0 || isLoading}
                  >
                    {isLoading ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <IconKey className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No API keys yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first API key to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your API Keys</CardTitle>
            <CardDescription>
              Manage your existing API keys and their permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-sm">
                        {key.start}...
                      </code>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const perms = key.metadata?.permissions || key.permissions || {};
                        const allPerms = Object.entries(perms).flatMap(
                          ([, p]) => p as string[]
                        );
                        const count = allPerms.length;
                        if (count === 0) return <span className="text-muted-foreground">None</span>;
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="cursor-default">
                                  {count} permission{count !== 1 ? "s" : ""}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="flex flex-col gap-1">
                                  {allPerms.map((perm) => (
                                    <span key={perm} className="text-xs">{perm}</span>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <IconTrash className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
