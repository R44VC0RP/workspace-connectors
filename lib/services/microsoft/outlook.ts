/**
 * Microsoft Outlook Mail Service
 *
 * Provides email operations via Microsoft Graph API for Outlook.
 * Mirrors the Gmail service structure for consistency.
 */

import { getGraphClient } from "./client";

// ============================================================================
// Types
// ============================================================================

export interface MessageListOptions {
  maxResults?: number;
  pageToken?: string; // $skipToken for Graph API
  q?: string; // $search query
  folderId?: string; // Filter by folder (similar to Gmail labelIds)
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  folderIds?: string[];
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
}

export interface MessageDetail extends MessageSummary {
  body?: string;
  bodyHtml?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
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
  saveToSentItems?: boolean;
}

export interface SendMessageResult {
  id: string;
  conversationId: string;
}

// Folder types (equivalent to Gmail labels)
export interface OutlookFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount?: number;
  unreadItemCount?: number;
  totalItemCount?: number;
  isHidden?: boolean;
}

export interface FolderListResult {
  folders: OutlookFolder[];
  nextPageToken?: string;
}

// Conversation types (equivalent to Gmail threads)
export interface ConversationListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  folderId?: string;
}

export interface ConversationSummary {
  id: string;
  topic?: string;
  lastDeliveredTime?: string;
  uniqueSenders?: string[];
  hasAttachments?: boolean;
  messageCount?: number;
}

export interface ConversationDetail {
  id: string;
  topic?: string;
  messages: MessageDetail[];
}

export interface ConversationListResult {
  conversations: ConversationSummary[];
  nextPageToken?: string;
}

// ============================================================================
// Graph API Response Types
// ============================================================================

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  replyTo?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  bodyPreview?: string;
  body?: {
    contentType?: string;
    content?: string;
  };
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  parentFolderId?: string;
}

interface GraphMailFolder {
  id: string;
  displayName?: string;
  parentFolderId?: string;
  childFolderCount?: number;
  unreadItemCount?: number;
  totalItemCount?: number;
  isHidden?: boolean;
}

interface GraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format email address from Graph API format to string.
 */
function formatEmailAddress(
  recipient?: { emailAddress?: { name?: string; address?: string } }
): string | undefined {
  if (!recipient?.emailAddress) return undefined;
  const { name, address } = recipient.emailAddress;
  if (name && address) {
    return `${name} <${address}>`;
  }
  return address;
}

/**
 * Format array of recipients to comma-separated string.
 */
function formatRecipients(
  recipients?: Array<{ emailAddress?: { name?: string; address?: string } }>
): string | undefined {
  if (!recipients?.length) return undefined;
  return recipients
    .map((r) => formatEmailAddress(r))
    .filter(Boolean)
    .join(", ");
}

/**
 * Parse email string to Graph API recipient format.
 */
function parseRecipient(
  email: string
): { emailAddress: { address: string; name?: string } } {
  // Handle "Name <email@example.com>" format
  const match = email.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      emailAddress: {
        name: match[1].trim(),
        address: match[2].trim(),
      },
    };
  }
  return {
    emailAddress: {
      address: email.trim(),
    },
  };
}

/**
 * Parse email string or array to Graph API recipients format.
 */
function parseRecipients(
  emails: string | string[]
): Array<{ emailAddress: { address: string; name?: string } }> {
  const emailList = Array.isArray(emails) ? emails : [emails];
  return emailList.map(parseRecipient);
}

/**
 * Extract next page token from @odata.nextLink URL.
 */
function extractNextPageToken(nextLink?: string): string | undefined {
  if (!nextLink) return undefined;
  // The nextLink is the full URL, we'll just return it as the token
  return nextLink;
}

/**
 * Transform Graph message to our MessageSummary format.
 */
function transformToMessageSummary(msg: GraphMessage): MessageSummary {
  return {
    id: msg.id,
    conversationId: msg.conversationId || "",
    subject: msg.subject,
    from: formatEmailAddress(msg.from),
    to: formatRecipients(msg.toRecipients),
    date: msg.receivedDateTime || msg.sentDateTime,
    snippet: msg.bodyPreview,
    isRead: msg.isRead,
    isDraft: msg.isDraft,
    hasAttachments: msg.hasAttachments,
    folderIds: msg.parentFolderId ? [msg.parentFolderId] : undefined,
  };
}

/**
 * Transform Graph message to our MessageDetail format.
 */
function transformToMessageDetail(msg: GraphMessage): MessageDetail {
  const summary = transformToMessageSummary(msg);

  return {
    ...summary,
    body: msg.body?.contentType === "text" ? msg.body.content : undefined,
    bodyHtml: msg.body?.contentType === "html" ? msg.body.content : msg.body?.content,
    cc: formatRecipients(msg.ccRecipients),
    bcc: formatRecipients(msg.bccRecipients),
    replyTo: formatRecipients(msg.replyTo),
  };
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * List messages from Outlook.
 */
export async function listMessages(
  accessToken: string,
  options: MessageListOptions = {}
): Promise<MessageListResult> {
  const client = getGraphClient(accessToken);

  const params = new URLSearchParams();
  params.set("$top", String(options.maxResults || 20));
  params.set(
    "$select",
    "id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,isDraft,hasAttachments,parentFolderId"
  );
  params.set("$orderby", "receivedDateTime desc");

  if (options.q) {
    params.set("$search", `"${options.q}"`);
  }

  let endpoint = "/me/messages";
  if (options.folderId) {
    endpoint = `/me/mailFolders/${options.folderId}/messages`;
  }

  // Handle pagination
  let url = `${endpoint}?${params.toString()}`;
  if (options.pageToken) {
    // pageToken is the full nextLink URL
    url = options.pageToken;
  }

  const response = await client.get<GraphListResponse<GraphMessage>>(url);

  return {
    messages: response.value.map(transformToMessageSummary),
    nextPageToken: extractNextPageToken(response["@odata.nextLink"]),
  };
}

/**
 * Get a single message with full content.
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<MessageDetail | null> {
  const client = getGraphClient(accessToken);

  try {
    const response = await client.get<GraphMessage>(
      `/me/messages/${messageId}?$select=id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,bodyPreview,body,isRead,isDraft,hasAttachments,parentFolderId`
    );

    return transformToMessageDetail(response);
  } catch (error) {
    console.error("Failed to get message:", error);
    return null;
  }
}

/**
 * Send an email message.
 */
export async function sendMessage(
  accessToken: string,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const client = getGraphClient(accessToken);

  const message: Record<string, unknown> = {
    subject: options.subject,
    body: {
      contentType: options.html ? "html" : "text",
      content: options.html || options.body,
    },
    toRecipients: parseRecipients(options.to),
  };

  if (options.cc) {
    message.ccRecipients = parseRecipients(options.cc);
  }
  if (options.bcc) {
    message.bccRecipients = parseRecipients(options.bcc);
  }
  if (options.replyTo) {
    message.replyTo = parseRecipients(options.replyTo);
  }

  const requestBody = {
    message,
    saveToSentItems: options.saveToSentItems !== false,
  };

  // Graph API sendMail doesn't return the message, so we need to create and send
  await client.post("/me/sendMail", requestBody);

  // Since sendMail doesn't return the message ID, we return empty strings
  // In practice, the message will be in Sent Items folder
  return {
    id: "",
    conversationId: "",
  };
}

/**
 * Create a draft message (doesn't send).
 */
export async function createDraft(
  accessToken: string,
  options: Omit<SendMessageOptions, "saveToSentItems">
): Promise<MessageDetail> {
  const client = getGraphClient(accessToken);

  const message: Record<string, unknown> = {
    subject: options.subject,
    body: {
      contentType: options.html ? "html" : "text",
      content: options.html || options.body,
    },
    toRecipients: parseRecipients(options.to),
  };

  if (options.cc) {
    message.ccRecipients = parseRecipients(options.cc);
  }
  if (options.bcc) {
    message.bccRecipients = parseRecipients(options.bcc);
  }
  if (options.replyTo) {
    message.replyTo = parseRecipients(options.replyTo);
  }

  const response = await client.post<GraphMessage>("/me/messages", message);

  return transformToMessageDetail(response);
}

/**
 * Update a draft message.
 */
export async function updateDraft(
  accessToken: string,
  messageId: string,
  options: Partial<Omit<SendMessageOptions, "saveToSentItems">>
): Promise<MessageDetail> {
  const client = getGraphClient(accessToken);

  const updates: Record<string, unknown> = {};

  if (options.subject !== undefined) {
    updates.subject = options.subject;
  }
  if (options.body !== undefined || options.html !== undefined) {
    updates.body = {
      contentType: options.html ? "html" : "text",
      content: options.html || options.body,
    };
  }
  if (options.to !== undefined) {
    updates.toRecipients = parseRecipients(options.to);
  }
  if (options.cc !== undefined) {
    updates.ccRecipients = parseRecipients(options.cc);
  }
  if (options.bcc !== undefined) {
    updates.bccRecipients = parseRecipients(options.bcc);
  }
  if (options.replyTo !== undefined) {
    updates.replyTo = parseRecipients(options.replyTo);
  }

  const response = await client.patch<GraphMessage>(
    `/me/messages/${messageId}`,
    updates
  );

  return transformToMessageDetail(response);
}

/**
 * Send a draft message.
 */
export async function sendDraft(
  accessToken: string,
  messageId: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  await client.post(`/me/messages/${messageId}/send`);
}

/**
 * Delete a draft message.
 */
export async function deleteDraft(
  accessToken: string,
  messageId: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  await client.delete(`/me/messages/${messageId}`);
}

// ============================================================================
// Trash Operations
// ============================================================================

/**
 * Move a message to Deleted Items (trash).
 */
export async function trashMessage(
  accessToken: string,
  messageId: string
): Promise<MessageSummary> {
  const client = getGraphClient(accessToken);

  // Get the Deleted Items folder ID
  const deletedItemsFolder = await client.get<GraphMailFolder>(
    "/me/mailFolders/deleteditems"
  );

  // Move the message
  const response = await client.post<GraphMessage>(
    `/me/messages/${messageId}/move`,
    { destinationId: deletedItemsFolder.id }
  );

  return transformToMessageSummary(response);
}

/**
 * Move a message from Deleted Items back to Inbox.
 */
export async function untrashMessage(
  accessToken: string,
  messageId: string
): Promise<MessageSummary> {
  const client = getGraphClient(accessToken);

  // Get the Inbox folder ID
  const inboxFolder = await client.get<GraphMailFolder>("/me/mailFolders/inbox");

  // Move the message
  const response = await client.post<GraphMessage>(
    `/me/messages/${messageId}/move`,
    { destinationId: inboxFolder.id }
  );

  return transformToMessageSummary(response);
}

/**
 * Permanently delete a message.
 */
export async function deleteMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  await client.delete(`/me/messages/${messageId}`);
}

// ============================================================================
// Message Modification
// ============================================================================

export interface ModifyMessageOptions {
  isRead?: boolean;
  categories?: string[];
  flag?: {
    flagStatus: "notFlagged" | "flagged" | "complete";
  };
}

/**
 * Modify message properties (read status, categories, flag).
 */
export async function modifyMessage(
  accessToken: string,
  messageId: string,
  options: ModifyMessageOptions
): Promise<MessageSummary> {
  const client = getGraphClient(accessToken);

  const updates: Record<string, unknown> = {};

  if (options.isRead !== undefined) {
    updates.isRead = options.isRead;
  }
  if (options.categories !== undefined) {
    updates.categories = options.categories;
  }
  if (options.flag !== undefined) {
    updates.flag = options.flag;
  }

  const response = await client.patch<GraphMessage>(
    `/me/messages/${messageId}`,
    updates
  );

  return transformToMessageSummary(response);
}

/**
 * Move a message to a different folder.
 */
export async function moveMessage(
  accessToken: string,
  messageId: string,
  destinationFolderId: string
): Promise<MessageSummary> {
  const client = getGraphClient(accessToken);

  const response = await client.post<GraphMessage>(
    `/me/messages/${messageId}/move`,
    { destinationId: destinationFolderId }
  );

  return transformToMessageSummary(response);
}

/**
 * Copy a message to a different folder.
 */
export async function copyMessage(
  accessToken: string,
  messageId: string,
  destinationFolderId: string
): Promise<MessageSummary> {
  const client = getGraphClient(accessToken);

  const response = await client.post<GraphMessage>(
    `/me/messages/${messageId}/copy`,
    { destinationId: destinationFolderId }
  );

  return transformToMessageSummary(response);
}

// ============================================================================
// Folder Operations (equivalent to Gmail Labels)
// ============================================================================

/**
 * List all mail folders.
 */
export async function listFolders(
  accessToken: string
): Promise<FolderListResult> {
  const client = getGraphClient(accessToken);

  const response = await client.get<GraphListResponse<GraphMailFolder>>(
    "/me/mailFolders?$top=100"
  );

  const folders: OutlookFolder[] = response.value.map((folder) => ({
    id: folder.id,
    displayName: folder.displayName || "",
    parentFolderId: folder.parentFolderId,
    childFolderCount: folder.childFolderCount,
    unreadItemCount: folder.unreadItemCount,
    totalItemCount: folder.totalItemCount,
    isHidden: folder.isHidden,
  }));

  return {
    folders,
    nextPageToken: extractNextPageToken(response["@odata.nextLink"]),
  };
}

/**
 * Get a single folder by ID.
 */
export async function getFolder(
  accessToken: string,
  folderId: string
): Promise<OutlookFolder | null> {
  const client = getGraphClient(accessToken);

  try {
    const response = await client.get<GraphMailFolder>(
      `/me/mailFolders/${folderId}`
    );

    return {
      id: response.id,
      displayName: response.displayName || "",
      parentFolderId: response.parentFolderId,
      childFolderCount: response.childFolderCount,
      unreadItemCount: response.unreadItemCount,
      totalItemCount: response.totalItemCount,
      isHidden: response.isHidden,
    };
  } catch (error) {
    console.error("Failed to get folder:", error);
    return null;
  }
}

/**
 * Create a new mail folder.
 */
export async function createFolder(
  accessToken: string,
  displayName: string,
  parentFolderId?: string
): Promise<OutlookFolder> {
  const client = getGraphClient(accessToken);

  const endpoint = parentFolderId
    ? `/me/mailFolders/${parentFolderId}/childFolders`
    : "/me/mailFolders";

  const response = await client.post<GraphMailFolder>(endpoint, {
    displayName,
  });

  return {
    id: response.id,
    displayName: response.displayName || displayName,
    parentFolderId: response.parentFolderId,
    childFolderCount: response.childFolderCount,
    unreadItemCount: response.unreadItemCount,
    totalItemCount: response.totalItemCount,
    isHidden: response.isHidden,
  };
}

/**
 * Update a mail folder.
 */
export async function updateFolder(
  accessToken: string,
  folderId: string,
  displayName: string
): Promise<OutlookFolder> {
  const client = getGraphClient(accessToken);

  const response = await client.patch<GraphMailFolder>(
    `/me/mailFolders/${folderId}`,
    { displayName }
  );

  return {
    id: response.id,
    displayName: response.displayName || displayName,
    parentFolderId: response.parentFolderId,
    childFolderCount: response.childFolderCount,
    unreadItemCount: response.unreadItemCount,
    totalItemCount: response.totalItemCount,
    isHidden: response.isHidden,
  };
}

/**
 * Delete a mail folder.
 */
export async function deleteFolder(
  accessToken: string,
  folderId: string
): Promise<void> {
  const client = getGraphClient(accessToken);

  await client.delete(`/me/mailFolders/${folderId}`);
}

// ============================================================================
// Well-known Folders
// ============================================================================

export type WellKnownFolder =
  | "inbox"
  | "drafts"
  | "sentitems"
  | "deleteditems"
  | "junkemail"
  | "archive"
  | "outbox";

/**
 * Get a well-known folder (inbox, drafts, sentitems, etc.).
 */
export async function getWellKnownFolder(
  accessToken: string,
  folderName: WellKnownFolder
): Promise<OutlookFolder | null> {
  const client = getGraphClient(accessToken);

  try {
    const response = await client.get<GraphMailFolder>(
      `/me/mailFolders/${folderName}`
    );

    return {
      id: response.id,
      displayName: response.displayName || folderName,
      parentFolderId: response.parentFolderId,
      childFolderCount: response.childFolderCount,
      unreadItemCount: response.unreadItemCount,
      totalItemCount: response.totalItemCount,
      isHidden: response.isHidden,
    };
  } catch (error) {
    console.error(`Failed to get ${folderName} folder:`, error);
    return null;
  }
}

// ============================================================================
// Conversation Operations (equivalent to Gmail Threads)
// ============================================================================

/**
 * List messages grouped by conversation.
 * Note: Microsoft Graph doesn't have a direct conversations endpoint,
 * so we group messages by conversationId.
 */
export async function listConversations(
  accessToken: string,
  options: ConversationListOptions = {}
): Promise<ConversationListResult> {
  const client = getGraphClient(accessToken);

  // Get messages and group by conversationId
  const params = new URLSearchParams();
  params.set("$top", String(options.maxResults || 50));
  params.set(
    "$select",
    "id,conversationId,subject,from,receivedDateTime,hasAttachments"
  );
  params.set("$orderby", "receivedDateTime desc");

  if (options.q) {
    params.set("$search", `"${options.q}"`);
  }

  let endpoint = "/me/messages";
  if (options.folderId) {
    endpoint = `/me/mailFolders/${options.folderId}/messages`;
  }

  let url = `${endpoint}?${params.toString()}`;
  if (options.pageToken) {
    url = options.pageToken;
  }

  const response = await client.get<GraphListResponse<GraphMessage>>(url);

  // Group messages by conversationId
  const conversationMap = new Map<
    string,
    {
      id: string;
      topic?: string;
      lastDeliveredTime?: string;
      senders: Set<string>;
      hasAttachments: boolean;
      messageCount: number;
    }
  >();

  for (const msg of response.value) {
    const convId = msg.conversationId || msg.id;
    const existing = conversationMap.get(convId);

    if (existing) {
      existing.messageCount++;
      if (msg.from?.emailAddress?.address) {
        existing.senders.add(msg.from.emailAddress.address);
      }
      if (msg.hasAttachments) {
        existing.hasAttachments = true;
      }
      // Update last delivered time if newer
      if (
        msg.receivedDateTime &&
        (!existing.lastDeliveredTime ||
          msg.receivedDateTime > existing.lastDeliveredTime)
      ) {
        existing.lastDeliveredTime = msg.receivedDateTime;
      }
    } else {
      conversationMap.set(convId, {
        id: convId,
        topic: msg.subject,
        lastDeliveredTime: msg.receivedDateTime,
        senders: new Set(
          msg.from?.emailAddress?.address ? [msg.from.emailAddress.address] : []
        ),
        hasAttachments: msg.hasAttachments || false,
        messageCount: 1,
      });
    }
  }

  const conversations: ConversationSummary[] = Array.from(
    conversationMap.values()
  ).map((conv) => ({
    id: conv.id,
    topic: conv.topic,
    lastDeliveredTime: conv.lastDeliveredTime,
    uniqueSenders: Array.from(conv.senders),
    hasAttachments: conv.hasAttachments,
    messageCount: conv.messageCount,
  }));

  return {
    conversations,
    nextPageToken: extractNextPageToken(response["@odata.nextLink"]),
  };
}

/**
 * Get all messages in a conversation.
 */
export async function getConversation(
  accessToken: string,
  conversationId: string
): Promise<ConversationDetail | null> {
  const client = getGraphClient(accessToken);

  try {
    // Fetch all messages with this conversationId
    const response = await client.get<GraphListResponse<GraphMessage>>(
      `/me/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc`
    );

    if (response.value.length === 0) {
      return null;
    }

    const messages = response.value.map(transformToMessageDetail);

    return {
      id: conversationId,
      topic: messages[0]?.subject,
      messages,
    };
  } catch (error) {
    console.error("Failed to get conversation:", error);
    return null;
  }
}
