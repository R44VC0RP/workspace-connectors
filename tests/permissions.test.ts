import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSIONS_REQUIRING_REAUTH,
  hasPermission,
  requiresReauth,
  getRequiredScope,
  getAvailablePermissions,
  validatePermissionsAgainstScopes,
} from "@/lib/api/permissions";

describe("Permissions System", () => {
  describe("PERMISSIONS", () => {
    it("should have all Gmail permissions defined", () => {
      expect(PERMISSIONS.google["mail:read"]).toBeDefined();
      expect(PERMISSIONS.google["mail:send"]).toBeDefined();
      expect(PERMISSIONS.google["mail:modify"]).toBeDefined();
      expect(PERMISSIONS.google["mail:labels"]).toBeDefined();
      expect(PERMISSIONS.google["mail:drafts"]).toBeDefined();
    });

    it("should have all Calendar permissions defined", () => {
      expect(PERMISSIONS.google["calendar:read"]).toBeDefined();
      expect(PERMISSIONS.google["calendar:write"]).toBeDefined();
    });

    it("should have correct scope mappings", () => {
      expect(PERMISSIONS.google["mail:read"].scope).toBe("gmail.readonly");
      expect(PERMISSIONS.google["mail:send"].scope).toBe("gmail.send");
      expect(PERMISSIONS.google["mail:modify"].scope).toBe("gmail.modify");
      expect(PERMISSIONS.google["mail:labels"].scope).toBe("gmail.labels");
      expect(PERMISSIONS.google["mail:drafts"].scope).toBe("gmail.compose");
      expect(PERMISSIONS.google["calendar:read"].scope).toBe("calendar.readonly");
      expect(PERMISSIONS.google["calendar:write"].scope).toBe("calendar.events");
    });

    it("should mark new permissions as requiring reauth", () => {
      expect(PERMISSIONS.google["mail:modify"].requiresReauth).toBe(true);
      expect(PERMISSIONS.google["mail:labels"].requiresReauth).toBe(true);
      expect(PERMISSIONS.google["mail:drafts"].requiresReauth).toBe(true);
    });

    it("should not mark original permissions as requiring reauth", () => {
      // Original permissions don't have requiresReauth property
      expect("requiresReauth" in PERMISSIONS.google["mail:read"]).toBe(false);
      expect("requiresReauth" in PERMISSIONS.google["mail:send"]).toBe(false);
      expect("requiresReauth" in PERMISSIONS.google["calendar:read"]).toBe(false);
      expect("requiresReauth" in PERMISSIONS.google["calendar:write"]).toBe(false);
    });
  });

  describe("PERMISSION_GROUPS", () => {
    it("should have readonly group with correct permissions", () => {
      expect(PERMISSION_GROUPS.readonly).toContain("mail:read");
      expect(PERMISSION_GROUPS.readonly).toContain("calendar:read");
      expect(PERMISSION_GROUPS.readonly).not.toContain("mail:send");
    });

    it("should have fullGmail group with all Gmail permissions", () => {
      expect(PERMISSION_GROUPS.fullGmail).toContain("mail:read");
      expect(PERMISSION_GROUPS.fullGmail).toContain("mail:send");
      expect(PERMISSION_GROUPS.fullGmail).toContain("mail:modify");
      expect(PERMISSION_GROUPS.fullGmail).toContain("mail:labels");
      expect(PERMISSION_GROUPS.fullGmail).toContain("mail:drafts");
    });

    it("should have fullCalendar group with all Calendar permissions", () => {
      expect(PERMISSION_GROUPS.fullCalendar).toContain("calendar:read");
      expect(PERMISSION_GROUPS.fullCalendar).toContain("calendar:write");
    });

    it("should have fullAccess group with all permissions", () => {
      expect(PERMISSION_GROUPS.fullAccess).toHaveLength(7);
    });
  });

  describe("hasPermission()", () => {
    const permissions = {
      google: ["mail:read", "mail:send", "calendar:read"],
    };

    it("should return true for granted permissions", () => {
      expect(hasPermission(permissions, "google", "mail:read")).toBe(true);
      expect(hasPermission(permissions, "google", "mail:send")).toBe(true);
      expect(hasPermission(permissions, "google", "calendar:read")).toBe(true);
    });

    it("should return false for non-granted permissions", () => {
      expect(hasPermission(permissions, "google", "mail:modify")).toBe(false);
      expect(hasPermission(permissions, "google", "mail:labels")).toBe(false);
      expect(hasPermission(permissions, "google", "mail:drafts")).toBe(false);
      expect(hasPermission(permissions, "google", "calendar:write")).toBe(false);
    });

    it("should return false for unknown provider", () => {
      expect(hasPermission(permissions, "unknown", "mail:read")).toBe(false);
    });

    it("should handle empty permissions object", () => {
      expect(hasPermission({}, "google", "mail:read")).toBe(false);
    });
  });

  describe("requiresReauth()", () => {
    it("should return true for permissions requiring reauth", () => {
      expect(requiresReauth(["mail:modify"])).toBe(true);
      expect(requiresReauth(["mail:labels"])).toBe(true);
      expect(requiresReauth(["mail:drafts"])).toBe(true);
    });

    it("should return false for permissions not requiring reauth", () => {
      expect(requiresReauth(["mail:read"])).toBe(false);
      expect(requiresReauth(["mail:send"])).toBe(false);
      expect(requiresReauth(["calendar:read"])).toBe(false);
      expect(requiresReauth(["calendar:write"])).toBe(false);
    });

    it("should return true if any permission requires reauth", () => {
      expect(requiresReauth(["mail:read", "mail:modify"])).toBe(true);
      expect(requiresReauth(["calendar:read", "mail:drafts"])).toBe(true);
    });

    it("should return false for empty array", () => {
      expect(requiresReauth([])).toBe(false);
    });
  });

  describe("getRequiredScope()", () => {
    it("should return correct OAuth scope for each permission", () => {
      expect(getRequiredScope("mail:read")).toBe("https://www.googleapis.com/auth/gmail.readonly");
      expect(getRequiredScope("mail:send")).toBe("https://www.googleapis.com/auth/gmail.send");
      expect(getRequiredScope("mail:modify")).toBe("https://www.googleapis.com/auth/gmail.modify");
      expect(getRequiredScope("mail:labels")).toBe("https://www.googleapis.com/auth/gmail.labels");
      expect(getRequiredScope("mail:drafts")).toBe("https://www.googleapis.com/auth/gmail.compose");
      expect(getRequiredScope("calendar:read")).toBe("https://www.googleapis.com/auth/calendar.readonly");
      expect(getRequiredScope("calendar:write")).toBe("https://www.googleapis.com/auth/calendar.events");
    });
  });

  describe("getAvailablePermissions()", () => {
    it("should return permissions based on granted scopes", () => {
      const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ];
      const available = getAvailablePermissions(scopes);
      
      expect(available).toContain("mail:read");
      expect(available).toContain("mail:send");
      expect(available).not.toContain("mail:modify");
      expect(available).not.toContain("calendar:read");
    });

    it("should return all permissions when all scopes are granted", () => {
      const allScopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ];
      const available = getAvailablePermissions(allScopes);
      
      expect(available).toHaveLength(7);
    });

    it("should return empty array for no scopes", () => {
      expect(getAvailablePermissions([])).toHaveLength(0);
    });
  });

  describe("validatePermissionsAgainstScopes()", () => {
    it("should validate when all required scopes are present", () => {
      const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ];
      const result = validatePermissionsAgainstScopes(["mail:read", "mail:send"], scopes);
      
      expect(result.valid).toBe(true);
      expect(result.missingScopes).toHaveLength(0);
    });

    it("should fail validation when scopes are missing", () => {
      const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
      const result = validatePermissionsAgainstScopes(["mail:read", "mail:modify"], scopes);
      
      expect(result.valid).toBe(false);
      expect(result.missingScopes).toContain("https://www.googleapis.com/auth/gmail.modify");
    });

    it("should report all missing scopes", () => {
      const result = validatePermissionsAgainstScopes(
        ["mail:read", "mail:modify", "mail:drafts"],
        []
      );
      
      expect(result.valid).toBe(false);
      expect(result.missingScopes).toHaveLength(3);
    });
  });

  describe("PERMISSIONS_REQUIRING_REAUTH", () => {
    it("should contain all new permissions that require re-authentication", () => {
      expect(PERMISSIONS_REQUIRING_REAUTH).toContain("mail:modify");
      expect(PERMISSIONS_REQUIRING_REAUTH).toContain("mail:labels");
      expect(PERMISSIONS_REQUIRING_REAUTH).toContain("mail:drafts");
    });

    it("should not contain original permissions", () => {
      expect(PERMISSIONS_REQUIRING_REAUTH).not.toContain("mail:read");
      expect(PERMISSIONS_REQUIRING_REAUTH).not.toContain("mail:send");
      expect(PERMISSIONS_REQUIRING_REAUTH).not.toContain("calendar:read");
      expect(PERMISSIONS_REQUIRING_REAUTH).not.toContain("calendar:write");
    });
  });
});
