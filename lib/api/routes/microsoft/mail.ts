import { Elysia, t } from "elysia";

import { verifyApiKey, getUserMicrosoftTokens } from "@/lib/api/auth";
import { hasPermission } from "@/lib/api/permissions";
import { checkAccess, trackUsage } from "@/lib/api/billing";
import {
  listMessages,
  getMessage,
  sendMessage,
  listFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  modifyMessage,
  trashMessage,
  untrashMessage,
  moveMessage,
  listConversations,
  getConversation,
  createDraft,
  updateDraft,
  deleteDraft,
  sendDraft,
  getWellKnownFolder,
} from "@/lib/services/microsoft/outlook";

// ============================================================================
// OpenAPI Response Schemas
// ============================================================================

const ErrorSchema = t.Object({
  error: t.String(),
  message: t.String(),
});

// Message schemas
const MessageSchema = t.Object({
  id: t.String(),
  conversationId: t.String(),
  subject: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  date: t.Optional(t.String()),
  snippet: t.Optional(t.String()),
  folderIds: t.Optional(t.Array(t.String())),
  isRead: t.Optional(t.Boolean()),
  isDraft: t.Optional(t.Boolean()),
  hasAttachments: t.Optional(t.Boolean()),
});

const MessageListSchema = t.Object({
  messages: t.Array(MessageSchema),
  nextPageToken: t.Optional(t.String()),
});

const MessageDetailSchema = t.Object({
  id: t.String(),
  conversationId: t.String(),
  subject: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  date: t.Optional(t.String()),
  body: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  cc: t.Optional(t.String()),
  bcc: t.Optional(t.String()),
  replyTo: t.Optional(t.String()),
  folderIds: t.Optional(t.Array(t.String())),
  isRead: t.Optional(t.Boolean()),
  isDraft: t.Optional(t.Boolean()),
  hasAttachments: t.Optional(t.Boolean()),
});

const SendMessageSchema = t.Object({
  id: t.String(),
  conversationId: t.String(),
});

// Folder schemas
const FolderSchema = t.Object({
  id: t.String(),
  displayName: t.String(),
  parentFolderId: t.Optional(t.String()),
  childFolderCount: t.Optional(t.Number()),
  unreadItemCount: t.Optional(t.Number()),
  totalItemCount: t.Optional(t.Number()),
  isHidden: t.Optional(t.Boolean()),
});

const FolderListSchema = t.Object({
  folders: t.Array(FolderSchema),
  nextPageToken: t.Optional(t.String()),
});

// Conversation schemas
const ConversationSummarySchema = t.Object({
  id: t.String(),
  topic: t.Optional(t.String()),
  lastDeliveredTime: t.Optional(t.String()),
  uniqueSenders: t.Optional(t.Array(t.String())),
  hasAttachments: t.Optional(t.Boolean()),
  messageCount: t.Optional(t.Number()),
});

const ConversationListSchema = t.Object({
  conversations: t.Array(ConversationSummarySchema),
  nextPageToken: t.Optional(t.String()),
});

const ConversationDetailSchema = t.Object({
  id: t.String(),
  topic: t.Optional(t.String()),
  messages: t.Array(MessageDetailSchema),
});

// ============================================================================
// Auth Macro
// ============================================================================

/**
 * Microsoft Mail auth macro - validates API key, checks billing, and retrieves Microsoft access token
 */
const msMailAuth = new Elysia({ name: "ms-mail-auth" }).macro({
  msMailAuth: {
    async resolve({ headers, status, set }) {
      const authHeader = headers["authorization"];
      const apiKeyHeader = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!apiKeyHeader) {
        return status(401);
      }

      const result = await verifyApiKey(apiKeyHeader);
      if (!result.valid || !result.data) {
        return status(401);
      }

      // Check billing access (Autumn)
      const billingCheck = await checkAccess(result.data.userId);
      if (!billingCheck.allowed) {
        set.status = 402;
        return {
          error: "payment_required",
          message: billingCheck.error || "Upgrade to access the Workspace Connector API",
        };
      }

      // Check for any Microsoft mail permission
      const hasAnyMailPermission =
        hasPermission(result.data.permissions, "microsoft", "mail:read") ||
        hasPermission(result.data.permissions, "microsoft", "mail:send") ||
        hasPermission(result.data.permissions, "microsoft", "mail:modify");

      if (!hasAnyMailPermission) {
        return status(403);
      }

      // Get Microsoft tokens
      const tokens = await getUserMicrosoftTokens(result.data.userId);
      if (!tokens?.accessToken) {
        set.status = 401;
        return {
          error: "unauthorized",
          message: "No Microsoft account linked. Please connect your Microsoft account in the dashboard.",
        };
      }

      // Track API usage
      await trackUsage(result.data.userId);

      return {
        microsoftAccessToken: tokens.accessToken,
        permissions: result.data.permissions,
        userId: result.data.userId,
      };
    },
  },
});

// ============================================================================
// Routes
// ============================================================================

export const microsoftMailRoutes = new Elysia({ prefix: "/microsoft/mail" })
  .use(msMailAuth)

  // ========== MESSAGES ==========
  
  // List messages
  .get(
    "/messages",
    async ({ query, microsoftAccessToken }) => {
      const result = await listMessages(microsoftAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        q: query.q,
        folderId: query.folderId,
      });

      return result;
    },
    {
      msMailAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 20 })),
        pageToken: t.Optional(t.String()),
        q: t.Optional(t.String({ description: "Search query" })),
        folderId: t.Optional(t.String({ description: "Filter by folder ID" })),
      }),
      response: {
        200: MessageListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List email messages",
        description: "Retrieve a list of email messages from Outlook. Requires `mail:read` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single message
  .get(
    "/messages/:id",
    async ({ params, microsoftAccessToken, set }) => {
      const message = await getMessage(microsoftAccessToken!, params.id);

      if (!message) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Message not found",
        };
      }

      return message;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      response: {
        200: MessageDetailSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get email message",
        description: "Retrieve a specific email message by ID with full content. Requires `mail:read` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Send message
  .post(
    "/messages",
    async ({ body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:send")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:send",
        };
      }

      const result = await sendMessage(microsoftAccessToken!, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        html: body.html,
        cc: body.cc,
        bcc: body.bcc,
        replyTo: body.replyTo,
        saveToSentItems: body.saveToSentItems,
      });

      return result;
    },
    {
      msMailAuth: true,
      body: t.Object({
        to: t.Union([t.String(), t.Array(t.String())], {
          description: "Recipient email address(es)",
        }),
        subject: t.String({ description: "Email subject" }),
        body: t.String({ description: "Email body (plain text)" }),
        html: t.Optional(t.String({ description: "Email body (HTML)" })),
        cc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        bcc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        replyTo: t.Optional(t.String()),
        saveToSentItems: t.Optional(t.Boolean({ default: true })),
      }),
      response: {
        200: SendMessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Send email",
        description: "Send a new email message. Requires `mail:send` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Modify message (read status, categories, flag)
  .post(
    "/messages/:id/modify",
    async ({ params, body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await modifyMessage(microsoftAccessToken!, params.id, {
        isRead: body.isRead,
        categories: body.categories,
        flag: body.flag,
      });

      return result;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      body: t.Object({
        isRead: t.Optional(t.Boolean({ description: "Mark as read/unread" })),
        categories: t.Optional(t.Array(t.String(), { description: "Categories to set" })),
        flag: t.Optional(
          t.Object({
            flagStatus: t.Union([
              t.Literal("notFlagged"),
              t.Literal("flagged"),
              t.Literal("complete"),
            ]),
          })
        ),
      }),
      response: {
        200: MessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Modify message",
        description: "Modify message properties (read status, categories, flag). Requires `mail:modify` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Move message to folder
  .post(
    "/messages/:id/move",
    async ({ params, body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await moveMessage(
        microsoftAccessToken!,
        params.id,
        body.destinationFolderId
      );

      return result;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      body: t.Object({
        destinationFolderId: t.String({ description: "Destination folder ID" }),
      }),
      response: {
        200: MessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Move message",
        description: "Move a message to a different folder. Requires `mail:modify` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Trash message
  .post(
    "/messages/:id/trash",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await trashMessage(microsoftAccessToken!, params.id);
      return result;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      response: {
        200: MessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Trash message",
        description: "Move a message to Deleted Items. Requires `mail:modify` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Untrash message
  .post(
    "/messages/:id/untrash",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await untrashMessage(microsoftAccessToken!, params.id);
      return result;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      response: {
        200: MessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Untrash message",
        description: "Move a message from Deleted Items back to Inbox. Requires `mail:modify` permission.",
        tags: ["Outlook - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== FOLDERS ==========

  // List folders
  .get(
    "/folders",
    async ({ microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:read",
        };
      }

      const result = await listFolders(microsoftAccessToken!);
      return result;
    },
    {
      msMailAuth: true,
      response: {
        200: FolderListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List folders",
        description: "Retrieve all mail folders in the user's mailbox. Requires `mail:read` permission.",
        tags: ["Outlook - Folders"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get well-known folder
  .get(
    "/folders/wellknown/:name",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:read",
        };
      }

      const validNames = ["inbox", "drafts", "sentitems", "deleteditems", "junkemail", "archive", "outbox"];
      if (!validNames.includes(params.name)) {
        set.status = 400;
        return {
          error: "bad_request",
          message: `Invalid folder name. Must be one of: ${validNames.join(", ")}`,
        };
      }

      const folder = await getWellKnownFolder(
        microsoftAccessToken!,
        params.name as "inbox" | "drafts" | "sentitems" | "deleteditems" | "junkemail" | "archive" | "outbox"
      );

      if (!folder) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Folder not found",
        };
      }

      return folder;
    },
    {
      msMailAuth: true,
      params: t.Object({
        name: t.String({ description: "Well-known folder name (inbox, drafts, sentitems, deleteditems, junkemail, archive, outbox)" }),
      }),
      response: {
        200: FolderSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get well-known folder",
        description: "Retrieve a well-known folder by name. Requires `mail:read` permission.",
        tags: ["Outlook - Folders"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single folder
  .get(
    "/folders/:id",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:read",
        };
      }

      const folder = await getFolder(microsoftAccessToken!, params.id);

      if (!folder) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Folder not found",
        };
      }

      return folder;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Folder ID" }),
      }),
      response: {
        200: FolderSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get folder",
        description: "Retrieve a specific folder by ID. Requires `mail:read` permission.",
        tags: ["Outlook - Folders"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Create folder
  .post(
    "/folders",
    async ({ body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await createFolder(
        microsoftAccessToken!,
        body.displayName,
        body.parentFolderId
      );

      set.status = 201;
      return result;
    },
    {
      msMailAuth: true,
      body: t.Object({
        displayName: t.String({ description: "Folder name" }),
        parentFolderId: t.Optional(t.String({ description: "Parent folder ID for nested folders" })),
      }),
      response: {
        201: FolderSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Create folder",
        description: "Create a new mail folder. Requires `mail:modify` permission.",
        tags: ["Outlook - Folders"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update folder
  .patch(
    "/folders/:id",
    async ({ params, body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await updateFolder(
        microsoftAccessToken!,
        params.id,
        body.displayName
      );

      return result;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Folder ID" }),
      }),
      body: t.Object({
        displayName: t.String({ description: "New folder name" }),
      }),
      response: {
        200: FolderSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update folder",
        description: "Update a folder's name. Requires `mail:modify` permission.",
        tags: ["Outlook - Folders"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete folder
  .delete(
    "/folders/:id",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      await deleteFolder(microsoftAccessToken!, params.id);
      return { success: true };
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Folder ID" }),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Delete folder",
        description: "Delete a folder. Requires `mail:modify` permission.",
        tags: ["Outlook - Folders"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== CONVERSATIONS ==========

  // List conversations
  .get(
    "/conversations",
    async ({ query, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:read",
        };
      }

      const result = await listConversations(microsoftAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        q: query.q,
        folderId: query.folderId,
      });

      return result;
    },
    {
      msMailAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 20 })),
        pageToken: t.Optional(t.String()),
        q: t.Optional(t.String({ description: "Search query" })),
        folderId: t.Optional(t.String({ description: "Filter by folder ID" })),
      }),
      response: {
        200: ConversationListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List conversations",
        description: "Retrieve a list of email conversations. Requires `mail:read` permission.",
        tags: ["Outlook - Conversations"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single conversation
  .get(
    "/conversations/:id",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:read",
        };
      }

      const conversation = await getConversation(microsoftAccessToken!, params.id);

      if (!conversation) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Conversation not found",
        };
      }

      return conversation;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Conversation ID" }),
      }),
      response: {
        200: ConversationDetailSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get conversation",
        description: "Retrieve a specific conversation with all messages. Requires `mail:read` permission.",
        tags: ["Outlook - Conversations"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== DRAFTS ==========

  // Create draft
  .post(
    "/drafts",
    async ({ body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await createDraft(microsoftAccessToken!, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        html: body.html,
        cc: body.cc,
        bcc: body.bcc,
        replyTo: body.replyTo,
      });

      set.status = 201;
      return result;
    },
    {
      msMailAuth: true,
      body: t.Object({
        to: t.Union([t.String(), t.Array(t.String())], {
          description: "Recipient email address(es)",
        }),
        subject: t.String({ description: "Email subject" }),
        body: t.String({ description: "Email body (plain text)" }),
        html: t.Optional(t.String({ description: "Email body (HTML)" })),
        cc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        bcc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        replyTo: t.Optional(t.String()),
      }),
      response: {
        201: MessageDetailSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Create draft",
        description: "Create a new draft message. Requires `mail:modify` permission.",
        tags: ["Outlook - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update draft
  .patch(
    "/drafts/:id",
    async ({ params, body, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      const result = await updateDraft(microsoftAccessToken!, params.id, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        html: body.html,
        cc: body.cc,
        bcc: body.bcc,
        replyTo: body.replyTo,
      });

      return result;
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft message ID" }),
      }),
      body: t.Object({
        to: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        subject: t.Optional(t.String()),
        body: t.Optional(t.String()),
        html: t.Optional(t.String()),
        cc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        bcc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        replyTo: t.Optional(t.String()),
      }),
      response: {
        200: MessageDetailSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update draft",
        description: "Update an existing draft. Requires `mail:modify` permission.",
        tags: ["Outlook - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete draft
  .delete(
    "/drafts/:id",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:modify",
        };
      }

      await deleteDraft(microsoftAccessToken!, params.id);
      return { success: true };
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft message ID" }),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Delete draft",
        description: "Delete a draft. Requires `mail:modify` permission.",
        tags: ["Outlook - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Send draft
  .post(
    "/drafts/:id/send",
    async ({ params, microsoftAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "microsoft", "mail:send")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: microsoft:mail:send",
        };
      }

      await sendDraft(microsoftAccessToken!, params.id);
      return { success: true };
    },
    {
      msMailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft message ID" }),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Send draft",
        description: "Send a draft message. Requires `mail:send` permission.",
        tags: ["Outlook - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  );
