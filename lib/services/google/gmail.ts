import type { gmail_v1 } from "googleapis";

import { getGmailClient } from "./client";

// Types
export interface MessageListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  labelIds?: string[];
}

export interface MessageSummary {
  id: string;
  threadId: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
}

export interface MessageDetail extends MessageSummary {
  body?: string;
  bodyHtml?: string;
}

export interface MessageListResult {
  messages: MessageSummary[];
  nextPageToken?: string;
}

export interface SendMessageOptions {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface SendMessageResult {
  id: string;
  threadId: string;
}

/**
 * Extract header value from Gmail message headers.
 */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | undefined {
  const value = headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  )?.value;
  return value ?? undefined;
}

/**
 * Decode base64url encoded content.
 */
function decodeBase64Url(data: string): string {
  // Replace URL-safe characters and decode
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Extract body content from message payload.
 */
function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined
): { text?: string; html?: string } {
  if (!payload) return {};

  const result: { text?: string; html?: string } = {};

  // Handle single part messages
  if (payload.body?.data) {
    const mimeType = payload.mimeType || "";
    const decoded = decodeBase64Url(payload.body.data);
    if (mimeType.includes("html")) {
      result.html = decoded;
    } else {
      result.text = decoded;
    }
    return result;
  }

  // Handle multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        result.text = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        result.html = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        // Nested multipart
        const nested = extractBody(part);
        if (nested.text) result.text = nested.text;
        if (nested.html) result.html = nested.html;
      }
    }
  }

  return result;
}

/**
 * List messages from Gmail.
 */
export async function listMessages(
  accessToken: string,
  options: MessageListOptions = {}
): Promise<MessageListResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults: options.maxResults || 20,
    pageToken: options.pageToken,
    q: options.q,
    labelIds: options.labelIds,
  });

  const messageIds = response.data.messages || [];
  const nextPageToken = response.data.nextPageToken || undefined;

  // Fetch message details for each message (metadata only for list)
  const messagePromises = messageIds
    .filter((msg): msg is { id: string; threadId?: string | null } => !!msg.id)
    .map(async (msg): Promise<MessageSummary> => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });

      const headers = detail.data.payload?.headers;

      return {
        id: msg.id,
        threadId: msg.threadId || "",
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        date: getHeader(headers, "Date"),
        snippet: detail.data.snippet ?? undefined,
      };
    });

  const messages = await Promise.all(messagePromises);

  return { messages, nextPageToken };
}

/**
 * Get a single message with full content.
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<MessageDetail | null> {
  const gmail = getGmailClient(accessToken);

  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = response.data.payload?.headers;
    const bodyContent = extractBody(response.data.payload);

    return {
      id: response.data.id || messageId,
      threadId: response.data.threadId || "",
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
      body: bodyContent.text,
      bodyHtml: bodyContent.html,
    };
  } catch (error) {
    console.error("Failed to get message:", error);
    return null;
  }
}

/**
 * Create RFC 2822 formatted email message.
 */
function createRfc2822Message(options: SendMessageOptions): string {
  const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  const cc = options.cc
    ? Array.isArray(options.cc)
      ? options.cc.join(", ")
      : options.cc
    : undefined;
  const bcc = options.bcc
    ? Array.isArray(options.bcc)
      ? options.bcc.join(", ")
      : options.bcc
    : undefined;

  const lines: string[] = [];
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${options.subject}`);

  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  if (options.replyTo) lines.push(`Reply-To: ${options.replyTo}`);

  if (options.html) {
    // Multipart message with both text and HTML
    const boundary = `boundary_${Date.now()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("");
    lines.push(options.body);
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("");
    lines.push(options.html);
    lines.push(`--${boundary}--`);
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("");
    lines.push(options.body);
  }

  return lines.join("\r\n");
}

/**
 * Send an email message.
 */
export async function sendMessage(
  accessToken: string,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const gmail = getGmailClient(accessToken);

  const rawMessage = createRfc2822Message(options);
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  return {
    id: response.data.id || "",
    threadId: response.data.threadId || "",
  };
}
