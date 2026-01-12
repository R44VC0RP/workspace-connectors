/**
 * API Test Script for Workspace Connectors
 * 
 * This script tests the full API flow:
 * 1. API key verification
 * 2. Gmail endpoints (list messages, get message)
 * 3. Calendar endpoints (list events, create event, delete event)
 * 
 * Usage: bun run scripts/test-api.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.WORKCONN_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!API_KEY) {
  console.error("❌ WORKCONN_API_KEY not found in environment");
  process.exit(1);
}

console.log("🔧 Workspace Connectors API Test Suite");
console.log("=====================================");
console.log(`Base URL: ${BASE_URL}`);
console.log(`API Key: ${API_KEY.slice(0, 10)}...`);
console.log("");

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  data?: unknown;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<{ success: boolean; data?: unknown; error?: string }>
): Promise<void> {
  const start = Date.now();
  try {
    console.log(`⏳ Running: ${name}`);
    const result = await fn();
    const duration = Date.now() - start;
    
    if (result.success) {
      console.log(`✅ Passed: ${name} (${duration}ms)`);
      results.push({ name, passed: true, duration, data: result.data });
    } else {
      console.log(`❌ Failed: ${name} - ${result.error}`);
      results.push({ name, passed: false, duration, error: result.error });
    }
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ Error: ${name} - ${errorMsg}`);
    results.push({ name, passed: false, duration, error: errorMsg });
  }
  console.log("");
}

async function apiRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

// ============================================
// Health Check
// ============================================
async function testHealthCheck() {
  const response = await fetch(`${BASE_URL}/api/v1/health`);
  const data = await response.json();
  
  if (response.ok && data.status === "ok") {
    return { success: true, data };
  }
  return { success: false, error: `Status: ${response.status}` };
}

// ============================================
// Gmail Tests
// ============================================
async function testListMessages() {
  const response = await apiRequest("GET", "/api/v1/google/mail/messages?maxResults=5");
  
  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `Status ${response.status}: ${text}` };
  }
  
  const data = await response.json();
  
  if (Array.isArray(data.messages)) {
    return { success: true, data: { count: data.messages.length, hasMore: !!data.nextPageToken } };
  }
  return { success: false, error: "Invalid response format" };
}

async function testGetMessage(messageId: string) {
  const response = await apiRequest("GET", `/api/v1/google/mail/messages/${messageId}`);
  
  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `Status ${response.status}: ${text}` };
  }
  
  const data = await response.json();
  
  if (data.id && data.threadId) {
    return { success: true, data: { id: data.id, subject: data.subject } };
  }
  return { success: false, error: "Invalid message format" };
}

// ============================================
// Calendar Tests
// ============================================
async function testListEvents() {
  const response = await apiRequest("GET", "/api/v1/google/calendar/events?maxResults=5");
  
  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `Status ${response.status}: ${text}` };
  }
  
  const data = await response.json();
  
  if (Array.isArray(data.events)) {
    return { success: true, data: { count: data.events.length, hasMore: !!data.nextPageToken } };
  }
  return { success: false, error: "Invalid response format" };
}

async function testCreateEvent() {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later
  
  const eventData = {
    summary: "[Test] API Test Event",
    description: "This event was created by the API test script and should be deleted",
    start: {
      dateTime: start.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: "UTC",
    },
  };
  
  const response = await apiRequest("POST", "/api/v1/google/calendar/events", eventData);
  
  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `Status ${response.status}: ${text}` };
  }
  
  const data = await response.json();
  
  if (data.id) {
    return { success: true, data: { id: data.id, summary: data.summary } };
  }
  return { success: false, error: "Event creation failed - no ID returned" };
}

async function testDeleteEvent(eventId: string) {
  const response = await apiRequest("DELETE", `/api/v1/google/calendar/events/${eventId}`);
  
  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `Status ${response.status}: ${text}` };
  }
  
  const data = await response.json();
  
  if (data.success) {
    return { success: true, data: { deleted: eventId } };
  }
  return { success: false, error: "Delete failed" };
}

// ============================================
// Run All Tests
// ============================================
async function main() {
  console.log("📋 Running API Tests\n");
  
  // Health check (no auth required)
  await runTest("Health Check", testHealthCheck);
  
  // Gmail tests
  console.log("📧 Gmail API Tests");
  console.log("------------------");
  
  let messageId: string | null = null;
  
  await runTest("List Messages", async () => {
    const result = await testListMessages();
    // Store a message ID for the next test
    if (result.success) {
      const response = await apiRequest("GET", "/api/v1/google/mail/messages?maxResults=1");
      if (response.ok) {
        const data = await response.json();
        if (data.messages?.[0]?.id) {
          messageId = data.messages[0].id;
        }
      }
    }
    return result;
  });
  
  if (messageId) {
    await runTest("Get Single Message", () => testGetMessage(messageId!));
  } else {
    console.log("⏭️  Skipping Get Single Message (no messages found)\n");
  }
  
  // Calendar tests
  console.log("📅 Calendar API Tests");
  console.log("---------------------");
  
  await runTest("List Events", testListEvents);
  
  let createdEventId: string | null = null;
  
  await runTest("Create Event", async () => {
    const result = await testCreateEvent();
    if (result.success && result.data) {
      createdEventId = (result.data as { id: string }).id;
    }
    return result;
  });
  
  if (createdEventId) {
    await runTest("Delete Event", () => testDeleteEvent(createdEventId!));
  } else {
    console.log("⏭️  Skipping Delete Event (no event created)\n");
  }
  
  // Summary
  console.log("\n📊 Test Summary");
  console.log("===============");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log("");
  
  if (failed > 0) {
    console.log("❌ Failed Tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
