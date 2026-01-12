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
  labelIds?: string[];
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

// Label types
export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

export interface LabelListResult {
  labels: GmailLabel[];
}

// Thread types
export interface ThreadListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  labelIds?: string[];
}

export interface ThreadSummary {
  id: string;
  snippet?: string;
  historyId?: string;
}

export interface ThreadDetail {
  id: string;
  historyId?: string;
  messages: MessageDetail[];
}

export interface ThreadListResult {
  threads: ThreadSummary[];
  nextPageToken?: string;
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
        labelIds: detail.data.labelIds ?? undefined,
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
      labelIds: response.data.labelIds ?? undefined,
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

/**
 * List all labels in the user's mailbox.
 */
export async function listLabels(accessToken: string): Promise<LabelListResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.labels.list({
    userId: "me",
  });

  const labels: GmailLabel[] = (response.data.labels || []).map((label) => ({
    id: label.id || "",
    name: label.name || "",
    type: label.type === "system" ? "system" : "user",
    messageListVisibility:
      label.messageListVisibility === "show" ? "show" : "hide",
    labelListVisibility:
      label.labelListVisibility === "labelShow"
        ? "labelShow"
        : label.labelListVisibility === "labelShowIfUnread"
          ? "labelShowIfUnread"
          : "labelHide",
    messagesTotal: label.messagesTotal ?? undefined,
    messagesUnread: label.messagesUnread ?? undefined,
    threadsTotal: label.threadsTotal ?? undefined,
    threadsUnread: label.threadsUnread ?? undefined,
    color: label.color
      ? {
          textColor: label.color.textColor ?? undefined,
          backgroundColor: label.color.backgroundColor ?? undefined,
        }
      : undefined,
  }));

  return { labels };
}

/**
 * Get a single label by ID.
 */
export async function getLabel(
  accessToken: string,
  labelId: string
): Promise<GmailLabel | null> {
  const gmail = getGmailClient(accessToken);

  try {
    const response = await gmail.users.labels.get({
      userId: "me",
      id: labelId,
    });

    return {
      id: response.data.id || labelId,
      name: response.data.name || "",
      type: response.data.type === "system" ? "system" : "user",
      messageListVisibility:
        response.data.messageListVisibility === "show" ? "show" : "hide",
      labelListVisibility:
        response.data.labelListVisibility === "labelShow"
          ? "labelShow"
          : response.data.labelListVisibility === "labelShowIfUnread"
            ? "labelShowIfUnread"
            : "labelHide",
      messagesTotal: response.data.messagesTotal ?? undefined,
      messagesUnread: response.data.messagesUnread ?? undefined,
      threadsTotal: response.data.threadsTotal ?? undefined,
      threadsUnread: response.data.threadsUnread ?? undefined,
      color: response.data.color
        ? {
            textColor: response.data.color.textColor ?? undefined,
            backgroundColor: response.data.color.backgroundColor ?? undefined,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Failed to get label:", error);
    return null;
  }
}

/**
 * List threads from Gmail.
 */
export async function listThreads(
  accessToken: string,
  options: ThreadListOptions = {}
): Promise<ThreadListResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.threads.list({
    userId: "me",
    maxResults: options.maxResults || 20,
    pageToken: options.pageToken,
    q: options.q,
    labelIds: options.labelIds,
  });

  const threads: ThreadSummary[] = (response.data.threads || []).map(
    (thread) => ({
      id: thread.id || "",
      snippet: thread.snippet ?? undefined,
      historyId: thread.historyId ?? undefined,
    })
  );

  return {
    threads,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/**
 * Get a single thread with all messages.
 */
export async function getThread(
  accessToken: string,
  threadId: string
): Promise<ThreadDetail | null> {
  const gmail = getGmailClient(accessToken);

  try {
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages: MessageDetail[] = (response.data.messages || []).map(
      (msg) => {
        const headers = msg.payload?.headers;
        const bodyContent = extractBody(msg.payload);

        return {
          id: msg.id || "",
          threadId: msg.threadId || threadId,
          subject: getHeader(headers, "Subject"),
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          date: getHeader(headers, "Date"),
          snippet: msg.snippet ?? undefined,
          body: bodyContent.text,
          bodyHtml: bodyContent.html,
          labelIds: msg.labelIds ?? undefined,
        };
      }
    );

    return {
      id: response.data.id || threadId,
      historyId: response.data.historyId ?? undefined,
      messages,
    };
  } catch (error) {
    console.error("Failed to get thread:", error);
    return null;
  }
}

// ============================================================================
// Label Management (requires gmail.labels scope)
// ============================================================================

export interface CreateLabelOptions {
  name: string;
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

/**
 * Create a new label.
 * Requires gmail.labels scope.
 */
export async function createLabel(
  accessToken: string,
  options: CreateLabelOptions
): Promise<GmailLabel> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: options.name,
      messageListVisibility: options.messageListVisibility || "show",
      labelListVisibility: options.labelListVisibility || "labelShow",
      color: options.color,
    },
  });

  return {
    id: response.data.id || "",
    name: response.data.name || options.name,
    type: "user",
    messageListVisibility:
      response.data.messageListVisibility === "show" ? "show" : "hide",
    labelListVisibility:
      response.data.labelListVisibility === "labelShow"
        ? "labelShow"
        : response.data.labelListVisibility === "labelShowIfUnread"
          ? "labelShowIfUnread"
          : "labelHide",
    color: response.data.color
      ? {
          textColor: response.data.color.textColor ?? undefined,
          backgroundColor: response.data.color.backgroundColor ?? undefined,
        }
      : undefined,
  };
}

/**
 * Update an existing label.
 * Requires gmail.labels scope.
 */
export async function updateLabel(
  accessToken: string,
  labelId: string,
  options: Partial<CreateLabelOptions>
): Promise<GmailLabel> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.labels.update({
    userId: "me",
    id: labelId,
    requestBody: {
      name: options.name,
      messageListVisibility: options.messageListVisibility,
      labelListVisibility: options.labelListVisibility,
      color: options.color,
    },
  });

  return {
    id: response.data.id || labelId,
    name: response.data.name || "",
    type: response.data.type === "system" ? "system" : "user",
    messageListVisibility:
      response.data.messageListVisibility === "show" ? "show" : "hide",
    labelListVisibility:
      response.data.labelListVisibility === "labelShow"
        ? "labelShow"
        : response.data.labelListVisibility === "labelShowIfUnread"
          ? "labelShowIfUnread"
          : "labelHide",
    color: response.data.color
      ? {
          textColor: response.data.color.textColor ?? undefined,
          backgroundColor: response.data.color.backgroundColor ?? undefined,
        }
      : undefined,
  };
}

/**
 * Delete a label.
 * Requires gmail.labels scope.
 */
export async function deleteLabel(
  accessToken: string,
  labelId: string
): Promise<void> {
  const gmail = getGmailClient(accessToken);

  await gmail.users.labels.delete({
    userId: "me",
    id: labelId,
  });
}

// ============================================================================
// Message Modification (requires gmail.modify scope)
// ============================================================================

export interface ModifyMessageOptions {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface ModifyMessageResult {
  id: string;
  threadId: string;
  labelIds: string[];
}

/**
 * Modify labels on a message.
 * Requires gmail.modify scope.
 */
export async function modifyMessage(
  accessToken: string,
  messageId: string,
  options: ModifyMessageOptions
): Promise<ModifyMessageResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: options.addLabelIds,
      removeLabelIds: options.removeLabelIds,
    },
  });

  return {
    id: response.data.id || messageId,
    threadId: response.data.threadId || "",
    labelIds: response.data.labelIds || [],
  };
}

/**
 * Move a message to trash.
 * Requires gmail.modify scope.
 */
export async function trashMessage(
  accessToken: string,
  messageId: string
): Promise<ModifyMessageResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.messages.trash({
    userId: "me",
    id: messageId,
  });

  return {
    id: response.data.id || messageId,
    threadId: response.data.threadId || "",
    labelIds: response.data.labelIds || [],
  };
}

/**
 * Remove a message from trash.
 * Requires gmail.modify scope.
 */
export async function untrashMessage(
  accessToken: string,
  messageId: string
): Promise<ModifyMessageResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.messages.untrash({
    userId: "me",
    id: messageId,
  });

  return {
    id: response.data.id || messageId,
    threadId: response.data.threadId || "",
    labelIds: response.data.labelIds || [],
  };
}

/**
 * Modify labels on all messages in a thread.
 * Requires gmail.modify scope.
 */
export async function modifyThread(
  accessToken: string,
  threadId: string,
  options: ModifyMessageOptions
): Promise<{ id: string }> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: {
      addLabelIds: options.addLabelIds,
      removeLabelIds: options.removeLabelIds,
    },
  });

  return {
    id: response.data.id || threadId,
  };
}

/**
 * Move a thread to trash.
 * Requires gmail.modify scope.
 */
export async function trashThread(
  accessToken: string,
  threadId: string
): Promise<{ id: string }> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.threads.trash({
    userId: "me",
    id: threadId,
  });

  return {
    id: response.data.id || threadId,
  };
}

/**
 * Remove a thread from trash.
 * Requires gmail.modify scope.
 */
export async function untrashThread(
  accessToken: string,
  threadId: string
): Promise<{ id: string }> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.threads.untrash({
    userId: "me",
    id: threadId,
  });

  return {
    id: response.data.id || threadId,
  };
}

// ============================================================================
// Drafts (requires gmail.compose scope)
// ============================================================================

export interface DraftSummary {
  id: string;
  message: MessageSummary;
}

export interface DraftDetail {
  id: string;
  message: MessageDetail;
}

export interface DraftListResult {
  drafts: DraftSummary[];
  nextPageToken?: string;
}

export interface DraftListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
}

export interface CreateDraftOptions {
  to?: string | string[];
  subject?: string;
  body?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  threadId?: string;
}

/**
 * List drafts.
 * Requires gmail.compose scope.
 */
export async function listDrafts(
  accessToken: string,
  options: DraftListOptions = {}
): Promise<DraftListResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.drafts.list({
    userId: "me",
    maxResults: options.maxResults || 20,
    pageToken: options.pageToken,
    q: options.q,
  });

  const draftIds = response.data.drafts || [];
  const nextPageToken = response.data.nextPageToken ?? undefined;

  // Fetch draft details for each draft
  const draftPromises = draftIds
    .filter((draft): draft is { id: string } => !!draft.id)
    .map(async (draft): Promise<DraftSummary> => {
      const detail = await gmail.users.drafts.get({
        userId: "me",
        id: draft.id,
        format: "metadata",
      });

      const msg = detail.data.message;
      const headers = msg?.payload?.headers;

      return {
        id: draft.id,
        message: {
          id: msg?.id || "",
          threadId: msg?.threadId || "",
          subject: getHeader(headers, "Subject"),
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          date: getHeader(headers, "Date"),
          snippet: msg?.snippet ?? undefined,
          labelIds: msg?.labelIds ?? undefined,
        },
      };
    });

  const drafts = await Promise.all(draftPromises);

  return { drafts, nextPageToken };
}

/**
 * Get a single draft with full content.
 * Requires gmail.compose scope.
 */
export async function getDraft(
  accessToken: string,
  draftId: string
): Promise<DraftDetail | null> {
  const gmail = getGmailClient(accessToken);

  try {
    const response = await gmail.users.drafts.get({
      userId: "me",
      id: draftId,
      format: "full",
    });

    const msg = response.data.message;
    const headers = msg?.payload?.headers;
    const bodyContent = extractBody(msg?.payload);

    return {
      id: response.data.id || draftId,
      message: {
        id: msg?.id || "",
        threadId: msg?.threadId || "",
        subject: getHeader(headers, "Subject"),
        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        date: getHeader(headers, "Date"),
        snippet: msg?.snippet ?? undefined,
        body: bodyContent.text,
        bodyHtml: bodyContent.html,
        labelIds: msg?.labelIds ?? undefined,
      },
    };
  } catch (error) {
    console.error("Failed to get draft:", error);
    return null;
  }
}

/**
 * Create a new draft.
 * Requires gmail.compose scope.
 */
export async function createDraft(
  accessToken: string,
  options: CreateDraftOptions
): Promise<DraftSummary> {
  const gmail = getGmailClient(accessToken);

  // Build the raw message
  const lines: string[] = [];
  
  if (options.to) {
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    lines.push(`To: ${to}`);
  }
  if (options.subject) {
    lines.push(`Subject: ${options.subject}`);
  }
  if (options.cc) {
    const cc = Array.isArray(options.cc) ? options.cc.join(", ") : options.cc;
    lines.push(`Cc: ${cc}`);
  }
  if (options.bcc) {
    const bcc = Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc;
    lines.push(`Bcc: ${bcc}`);
  }
  if (options.replyTo) {
    lines.push(`Reply-To: ${options.replyTo}`);
  }

  if (options.html && options.body) {
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
    lines.push(options.body || "");
  }

  const rawMessage = lines.join("\r\n");
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encodedMessage,
        threadId: options.threadId,
      },
    },
  });

  const msg = response.data.message;

  return {
    id: response.data.id || "",
    message: {
      id: msg?.id || "",
      threadId: msg?.threadId || "",
      subject: options.subject,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      snippet: options.body?.substring(0, 100),
    },
  };
}

/**
 * Update an existing draft.
 * Requires gmail.compose scope.
 */
export async function updateDraft(
  accessToken: string,
  draftId: string,
  options: CreateDraftOptions
): Promise<DraftSummary> {
  const gmail = getGmailClient(accessToken);

  // Build the raw message (same as createDraft)
  const lines: string[] = [];
  
  if (options.to) {
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    lines.push(`To: ${to}`);
  }
  if (options.subject) {
    lines.push(`Subject: ${options.subject}`);
  }
  if (options.cc) {
    const cc = Array.isArray(options.cc) ? options.cc.join(", ") : options.cc;
    lines.push(`Cc: ${cc}`);
  }
  if (options.bcc) {
    const bcc = Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc;
    lines.push(`Bcc: ${bcc}`);
  }
  if (options.replyTo) {
    lines.push(`Reply-To: ${options.replyTo}`);
  }

  if (options.html && options.body) {
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
    lines.push(options.body || "");
  }

  const rawMessage = lines.join("\r\n");
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.drafts.update({
    userId: "me",
    id: draftId,
    requestBody: {
      message: {
        raw: encodedMessage,
        threadId: options.threadId,
      },
    },
  });

  const msg = response.data.message;

  return {
    id: response.data.id || draftId,
    message: {
      id: msg?.id || "",
      threadId: msg?.threadId || "",
      subject: options.subject,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      snippet: options.body?.substring(0, 100),
    },
  };
}

/**
 * Delete a draft.
 * Requires gmail.compose scope.
 */
export async function deleteDraft(
  accessToken: string,
  draftId: string
): Promise<void> {
  const gmail = getGmailClient(accessToken);

  await gmail.users.drafts.delete({
    userId: "me",
    id: draftId,
  });
}

/**
 * Send a draft.
 * Requires gmail.compose scope.
 */
export async function sendDraft(
  accessToken: string,
  draftId: string
): Promise<SendMessageResult> {
  const gmail = getGmailClient(accessToken);

  const response = await gmail.users.drafts.send({
    userId: "me",
    requestBody: {
      id: draftId,
    },
  });

  return {
    id: response.data.id || "",
    threadId: response.data.threadId || "",
  };
}
