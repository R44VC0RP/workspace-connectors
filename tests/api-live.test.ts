import { describe, it, expect } from "vitest";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Live API Tests
 *
 * These tests run against the actual API with a real API key.
 * Loads WORKCONN_API_KEY from .env.local automatically.
 *
 * Run with: bun test tests/api-live.test.ts
 */

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000/api/v1";
const API_KEY = process.env.WORKCONN_API_KEY;

// Skip all tests if no API key is provided
const describeIfApiKey = API_KEY ? describe : describe.skip;

describeIfApiKey("Live API Tests", () => {
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  describe("Gmail API", () => {
    describe("Messages", () => {
      let messageId: string;

      it("GET /google/mail/messages - should list messages", async () => {
        const res = await fetch(`${API_BASE}/google/mail/messages?maxResults=2`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("messages");
        expect(Array.isArray(data.messages)).toBe(true);

        if (data.messages.length > 0) {
          messageId = data.messages[0].id;
        }
      });

      it("GET /google/mail/messages/:id - should get message by ID", async () => {
        if (!messageId) {
          console.log("Skipping - no message ID available");
          return;
        }

        const res = await fetch(`${API_BASE}/google/mail/messages/${messageId}`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("id", messageId);
      });

      it("GET /google/mail/messages/:id?format=metadata - should get message metadata", async () => {
        if (!messageId) {
          console.log("Skipping - no message ID available");
          return;
        }

        const res = await fetch(`${API_BASE}/google/mail/messages/${messageId}?format=metadata`, {
          headers,
        });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("id", messageId);
      });

      it("GET /google/mail/messages?q=... - should search messages", async () => {
        const res = await fetch(
          `${API_BASE}/google/mail/messages?q=${encodeURIComponent("subject:test")}&maxResults=2`,
          { headers }
        );
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("messages");
      });
    });

    describe("Labels", () => {
      it("GET /google/mail/labels - should list labels", async () => {
        const res = await fetch(`${API_BASE}/google/mail/labels`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("labels");
        expect(Array.isArray(data.labels)).toBe(true);
        expect(data.labels.length).toBeGreaterThan(0);
      });

      it("GET /google/mail/labels/INBOX - should get INBOX label", async () => {
        const res = await fetch(`${API_BASE}/google/mail/labels/INBOX`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("id", "INBOX");
        expect(data).toHaveProperty("name", "INBOX");
      });

      it("GET /google/mail/labels/SENT - should get SENT label", async () => {
        const res = await fetch(`${API_BASE}/google/mail/labels/SENT`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("id", "SENT");
      });
    });

    describe("Threads", () => {
      let threadId: string;

      it("GET /google/mail/threads - should list threads", async () => {
        const res = await fetch(`${API_BASE}/google/mail/threads?maxResults=2`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("threads");
        expect(Array.isArray(data.threads)).toBe(true);

        if (data.threads.length > 0) {
          threadId = data.threads[0].id;
        }
      });

      it("GET /google/mail/threads/:id - should get thread by ID", async () => {
        if (!threadId) {
          console.log("Skipping - no thread ID available");
          return;
        }

        const res = await fetch(`${API_BASE}/google/mail/threads/${threadId}`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("id", threadId);
        expect(data).toHaveProperty("messages");
        expect(Array.isArray(data.messages)).toBe(true);
      });
    });

    describe("Drafts", () => {
      it("GET /google/mail/drafts - should list drafts", async () => {
        const res = await fetch(`${API_BASE}/google/mail/drafts?maxResults=2`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("drafts");
        expect(Array.isArray(data.drafts)).toBe(true);
      });
    });
  });

  describe("Calendar API", () => {
    describe("Calendars", () => {
      let primaryCalendarId: string;

      it("GET /google/calendar/calendars - should list calendars", async () => {
        const res = await fetch(`${API_BASE}/google/calendar/calendars`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("calendars");
        expect(Array.isArray(data.calendars)).toBe(true);
        expect(data.calendars.length).toBeGreaterThan(0);

        // Find the primary calendar
        const primary = data.calendars.find((c: { primary?: boolean }) => c.primary);
        if (primary) {
          primaryCalendarId = primary.id;
        }
      });

      it("GET /google/calendar/calendars/:id - should get primary calendar", async () => {
        if (!primaryCalendarId) {
          console.log("Skipping - no primary calendar ID available");
          return;
        }

        const res = await fetch(
          `${API_BASE}/google/calendar/calendars/${encodeURIComponent(primaryCalendarId)}`,
          { headers }
        );
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("id");
      });
    });

    describe("Events", () => {
      it("GET /google/calendar/events - should list events", async () => {
        const res = await fetch(`${API_BASE}/google/calendar/events?maxResults=3`, { headers });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("events");
        expect(Array.isArray(data.events)).toBe(true);
      });

      it("GET /google/calendar/events - should list upcoming events with timeMin", async () => {
        const now = new Date().toISOString();
        const res = await fetch(
          `${API_BASE}/google/calendar/events?maxResults=3&timeMin=${encodeURIComponent(now)}`,
          { headers }
        );
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("events");
      });
    });

    describe("Free/Busy", () => {
      it("POST /google/calendar/freebusy - should query free/busy", async () => {
        const now = new Date();
        const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

        const res = await fetch(`${API_BASE}/google/calendar/freebusy`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            timeMin: now.toISOString(),
            timeMax: later.toISOString(),
            items: [{ id: "primary" }],
          }),
        });
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty("calendars");
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 401 for missing authorization", async () => {
      const res = await fetch(`${API_BASE}/google/mail/messages`);
      expect(res.status).toBe(401);
    });

    it("should return 401 for invalid API key", async () => {
      const res = await fetch(`${API_BASE}/google/mail/messages`, {
        headers: { Authorization: "Bearer invalid_key_12345" },
      });
      expect(res.status).toBe(401);
    });

    it("should return 404 for non-existent message", async () => {
      const res = await fetch(`${API_BASE}/google/mail/messages/nonexistent123`, { headers });
      // Gmail API returns 404 for non-existent messages
      expect([404, 400]).toContain(res.status);
    });

    it("should return 404 for non-existent label", async () => {
      const res = await fetch(`${API_BASE}/google/mail/labels/NONEXISTENT_LABEL_12345`, { headers });
      expect([404, 400]).toContain(res.status);
    });
  });
});

// Log skip message if no API key
if (!API_KEY) {
  console.log("\n⚠️  Skipping live API tests - WORKCONN_API_KEY not set\n");
}
