import { Elysia, t } from "elysia";

import { verifyApiKey, getUserGoogleTokens } from "@/lib/api/auth";
import { hasPermission } from "@/lib/api/permissions";
import { checkAccess, trackUsage } from "@/lib/api/billing";
import {
  listMessages,
  getMessage,
  sendMessage,
  listLabels,
  getLabel,
  createLabel,
  updateLabel,
  deleteLabel,
  modifyMessage,
  trashMessage,
  untrashMessage,
  listThreads,
  getThread,
  modifyThread,
  trashThread,
  untrashThread,
  listDrafts,
  getDraft,
  createDraft,
  updateDraft,
  deleteDraft,
  sendDraft,
} from "@/lib/services/google/gmail";

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
  threadId: t.String(),
  subject: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  date: t.Optional(t.String()),
  snippet: t.Optional(t.String()),
  labelIds: t.Optional(t.Array(t.String())),
});

const MessageListSchema = t.Object({
  messages: t.Array(MessageSchema),
  nextPageToken: t.Optional(t.String()),
});

const MessageDetailSchema = t.Object({
  id: t.String(),
  threadId: t.String(),
  subject: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  date: t.Optional(t.String()),
  body: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  labelIds: t.Optional(t.Array(t.String())),
});

const SendMessageSchema = t.Object({
  id: t.String(),
  threadId: t.String(),
});

// Label schemas
const LabelColorSchema = t.Object({
  textColor: t.Optional(t.String()),
  backgroundColor: t.Optional(t.String()),
});

const LabelSchema = t.Object({
  id: t.String(),
  name: t.String(),
  type: t.Union([t.Literal("system"), t.Literal("user")]),
  messageListVisibility: t.Optional(t.Union([t.Literal("show"), t.Literal("hide")])),
  labelListVisibility: t.Optional(
    t.Union([t.Literal("labelShow"), t.Literal("labelShowIfUnread"), t.Literal("labelHide")])
  ),
  messagesTotal: t.Optional(t.Number()),
  messagesUnread: t.Optional(t.Number()),
  threadsTotal: t.Optional(t.Number()),
  threadsUnread: t.Optional(t.Number()),
  color: t.Optional(LabelColorSchema),
});

const LabelListSchema = t.Object({
  labels: t.Array(LabelSchema),
});

// Thread schemas
const ThreadSummarySchema = t.Object({
  id: t.String(),
  snippet: t.Optional(t.String()),
  historyId: t.Optional(t.String()),
});

const ThreadListSchema = t.Object({
  threads: t.Array(ThreadSummarySchema),
  nextPageToken: t.Optional(t.String()),
});

const ThreadDetailSchema = t.Object({
  id: t.String(),
  historyId: t.Optional(t.String()),
  messages: t.Array(MessageDetailSchema),
});

// Modify result schema
const ModifyResultSchema = t.Object({
  id: t.String(),
  threadId: t.String(),
  labelIds: t.Array(t.String()),
});

const ThreadModifyResultSchema = t.Object({
  id: t.String(),
});

// Draft schemas
const DraftSummarySchema = t.Object({
  id: t.String(),
  message: MessageSchema,
});

const DraftDetailSchema = t.Object({
  id: t.String(),
  message: MessageDetailSchema,
});

const DraftListSchema = t.Object({
  drafts: t.Array(DraftSummarySchema),
  nextPageToken: t.Optional(t.String()),
});

// ============================================================================
// Auth Macro
// ============================================================================

/**
 * Gmail auth macro - validates API key, checks billing, and retrieves Google access token
 */
const mailAuth = new Elysia({ name: "mail-auth" }).macro({
  mailAuth: {
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

      // Check for any mail permission
      const hasAnyMailPermission =
        hasPermission(result.data.permissions, "google", "mail:read") ||
        hasPermission(result.data.permissions, "google", "mail:send") ||
        hasPermission(result.data.permissions, "google", "mail:modify") ||
        hasPermission(result.data.permissions, "google", "mail:labels") ||
        hasPermission(result.data.permissions, "google", "mail:drafts");

      if (!hasAnyMailPermission) {
        return status(403);
      }

      // Get Google tokens
      const tokens = await getUserGoogleTokens(result.data.userId);
      if (!tokens?.accessToken) {
        return status(401);
      }

      // Track API usage
      await trackUsage(result.data.userId);

      return {
        googleAccessToken: tokens.accessToken,
        permissions: result.data.permissions,
        userId: result.data.userId,
      };
    },
  },
});

// ============================================================================
// Routes
// ============================================================================

export const googleMailRoutes = new Elysia({ prefix: "/google/mail" })
  .use(mailAuth)

  // ========== MESSAGES ==========
  
  // List messages
  .get(
    "/messages",
    async ({ query, googleAccessToken }) => {
      const labelIds = query.labelIds
        ? query.labelIds.split(",").map((l) => l.trim())
        : undefined;

      const result = await listMessages(googleAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        q: query.q,
        labelIds,
      });

      return result;
    },
    {
      mailAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 20 })),
        pageToken: t.Optional(t.String()),
        q: t.Optional(t.String({ description: "Gmail search query" })),
        labelIds: t.Optional(t.String({ description: "Comma-separated label IDs" })),
      }),
      response: {
        200: MessageListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List email messages",
        description: "Retrieve a list of email messages from Gmail. Requires `mail:read` permission.",
        tags: ["Gmail - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single message
  .get(
    "/messages/:id",
    async ({ params, googleAccessToken, set }) => {
      const message = await getMessage(googleAccessToken!, params.id);

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
      mailAuth: true,
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
        tags: ["Gmail - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Send message
  .post(
    "/messages",
    async ({ body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:send")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:send",
        };
      }

      const result = await sendMessage(googleAccessToken!, {
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
      mailAuth: true,
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
        200: SendMessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Send email",
        description: "Send a new email message. Requires `mail:send` permission.",
        tags: ["Gmail - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Modify message labels
  .post(
    "/messages/:id/modify",
    async ({ params, body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:modify",
        };
      }

      const result = await modifyMessage(googleAccessToken!, params.id, {
        addLabelIds: body.addLabelIds,
        removeLabelIds: body.removeLabelIds,
      });

      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      body: t.Object({
        addLabelIds: t.Optional(t.Array(t.String(), { description: "Label IDs to add" })),
        removeLabelIds: t.Optional(t.Array(t.String(), { description: "Label IDs to remove" })),
      }),
      response: {
        200: ModifyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Modify message labels",
        description: "Add or remove labels from a message. Requires `mail:modify` permission.",
        tags: ["Gmail - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Trash message
  .post(
    "/messages/:id/trash",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:modify",
        };
      }

      const result = await trashMessage(googleAccessToken!, params.id);
      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      response: {
        200: ModifyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Trash message",
        description: "Move a message to the trash. Requires `mail:modify` permission.",
        tags: ["Gmail - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Untrash message
  .post(
    "/messages/:id/untrash",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:modify",
        };
      }

      const result = await untrashMessage(googleAccessToken!, params.id);
      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Message ID" }),
      }),
      response: {
        200: ModifyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Untrash message",
        description: "Remove a message from the trash. Requires `mail:modify` permission.",
        tags: ["Gmail - Messages"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== LABELS ==========

  // List labels
  .get(
    "/labels",
    async ({ googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:read",
        };
      }

      const result = await listLabels(googleAccessToken!);
      return result;
    },
    {
      mailAuth: true,
      response: {
        200: LabelListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List labels",
        description: "Retrieve all labels in the user's mailbox. Requires `mail:read` permission.",
        tags: ["Gmail - Labels"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single label
  .get(
    "/labels/:id",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:read",
        };
      }

      const label = await getLabel(googleAccessToken!, params.id);

      if (!label) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Label not found",
        };
      }

      return label;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Label ID" }),
      }),
      response: {
        200: LabelSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get label",
        description: "Retrieve a specific label by ID. Requires `mail:read` permission.",
        tags: ["Gmail - Labels"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Create label
  .post(
    "/labels",
    async ({ body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:labels")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:labels",
        };
      }

      const result = await createLabel(googleAccessToken!, {
        name: body.name,
        messageListVisibility: body.messageListVisibility,
        labelListVisibility: body.labelListVisibility,
        color: body.color,
      });

      set.status = 201;
      return result;
    },
    {
      mailAuth: true,
      body: t.Object({
        name: t.String({ description: "Label name" }),
        messageListVisibility: t.Optional(t.Union([t.Literal("show"), t.Literal("hide")])),
        labelListVisibility: t.Optional(
          t.Union([t.Literal("labelShow"), t.Literal("labelShowIfUnread"), t.Literal("labelHide")])
        ),
        color: t.Optional(
          t.Object({
            textColor: t.Optional(t.String({ description: "Hex color code (e.g., #000000)" })),
            backgroundColor: t.Optional(t.String({ description: "Hex color code (e.g., #ffffff)" })),
          })
        ),
      }),
      response: {
        201: LabelSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Create label",
        description: "Create a new label. Requires `mail:labels` permission.",
        tags: ["Gmail - Labels"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update label
  .patch(
    "/labels/:id",
    async ({ params, body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:labels")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:labels",
        };
      }

      const result = await updateLabel(googleAccessToken!, params.id, {
        name: body.name,
        messageListVisibility: body.messageListVisibility,
        labelListVisibility: body.labelListVisibility,
        color: body.color,
      });

      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Label ID" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ description: "Label name" })),
        messageListVisibility: t.Optional(t.Union([t.Literal("show"), t.Literal("hide")])),
        labelListVisibility: t.Optional(
          t.Union([t.Literal("labelShow"), t.Literal("labelShowIfUnread"), t.Literal("labelHide")])
        ),
        color: t.Optional(
          t.Object({
            textColor: t.Optional(t.String()),
            backgroundColor: t.Optional(t.String()),
          })
        ),
      }),
      response: {
        200: LabelSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update label",
        description: "Update an existing label. Requires `mail:labels` permission.",
        tags: ["Gmail - Labels"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete label
  .delete(
    "/labels/:id",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:labels")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:labels",
        };
      }

      await deleteLabel(googleAccessToken!, params.id);
      return { success: true };
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Label ID" }),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Delete label",
        description: "Delete a label. Requires `mail:labels` permission.",
        tags: ["Gmail - Labels"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== THREADS ==========

  // List threads
  .get(
    "/threads",
    async ({ query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:read",
        };
      }

      const labelIds = query.labelIds
        ? query.labelIds.split(",").map((l) => l.trim())
        : undefined;

      const result = await listThreads(googleAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        q: query.q,
        labelIds,
      });

      return result;
    },
    {
      mailAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 20 })),
        pageToken: t.Optional(t.String()),
        q: t.Optional(t.String({ description: "Gmail search query" })),
        labelIds: t.Optional(t.String({ description: "Comma-separated label IDs" })),
      }),
      response: {
        200: ThreadListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List threads",
        description: "Retrieve a list of email threads. Requires `mail:read` permission.",
        tags: ["Gmail - Threads"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single thread
  .get(
    "/threads/:id",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:read")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:read",
        };
      }

      const thread = await getThread(googleAccessToken!, params.id);

      if (!thread) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Thread not found",
        };
      }

      return thread;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Thread ID" }),
      }),
      response: {
        200: ThreadDetailSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get thread",
        description: "Retrieve a specific thread with all messages. Requires `mail:read` permission.",
        tags: ["Gmail - Threads"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Modify thread labels
  .post(
    "/threads/:id/modify",
    async ({ params, body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:modify",
        };
      }

      const result = await modifyThread(googleAccessToken!, params.id, {
        addLabelIds: body.addLabelIds,
        removeLabelIds: body.removeLabelIds,
      });

      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Thread ID" }),
      }),
      body: t.Object({
        addLabelIds: t.Optional(t.Array(t.String(), { description: "Label IDs to add" })),
        removeLabelIds: t.Optional(t.Array(t.String(), { description: "Label IDs to remove" })),
      }),
      response: {
        200: ThreadModifyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Modify thread labels",
        description: "Add or remove labels from all messages in a thread. Requires `mail:modify` permission.",
        tags: ["Gmail - Threads"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Trash thread
  .post(
    "/threads/:id/trash",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:modify",
        };
      }

      const result = await trashThread(googleAccessToken!, params.id);
      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Thread ID" }),
      }),
      response: {
        200: ThreadModifyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Trash thread",
        description: "Move all messages in a thread to the trash. Requires `mail:modify` permission.",
        tags: ["Gmail - Threads"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Untrash thread
  .post(
    "/threads/:id/untrash",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:modify")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:modify",
        };
      }

      const result = await untrashThread(googleAccessToken!, params.id);
      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Thread ID" }),
      }),
      response: {
        200: ThreadModifyResultSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Untrash thread",
        description: "Remove all messages in a thread from the trash. Requires `mail:modify` permission.",
        tags: ["Gmail - Threads"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // ========== DRAFTS ==========

  // List drafts
  .get(
    "/drafts",
    async ({ query, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:drafts")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:drafts",
        };
      }

      const result = await listDrafts(googleAccessToken!, {
        maxResults: query.maxResults,
        pageToken: query.pageToken,
        q: query.q,
      });

      return result;
    },
    {
      mailAuth: true,
      query: t.Object({
        maxResults: t.Optional(t.Number({ default: 20 })),
        pageToken: t.Optional(t.String()),
        q: t.Optional(t.String({ description: "Gmail search query" })),
      }),
      response: {
        200: DraftListSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "List drafts",
        description: "Retrieve a list of draft messages. Requires `mail:drafts` permission.",
        tags: ["Gmail - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Get single draft
  .get(
    "/drafts/:id",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:drafts")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:drafts",
        };
      }

      const draft = await getDraft(googleAccessToken!, params.id);

      if (!draft) {
        set.status = 404;
        return {
          error: "not_found",
          message: "Draft not found",
        };
      }

      return draft;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft ID" }),
      }),
      response: {
        200: DraftDetailSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get draft",
        description: "Retrieve a specific draft by ID. Requires `mail:drafts` permission.",
        tags: ["Gmail - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Create draft
  .post(
    "/drafts",
    async ({ body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:drafts")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:drafts",
        };
      }

      const result = await createDraft(googleAccessToken!, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        html: body.html,
        cc: body.cc,
        bcc: body.bcc,
        replyTo: body.replyTo,
        threadId: body.threadId,
      });

      set.status = 201;
      return result;
    },
    {
      mailAuth: true,
      body: t.Object({
        to: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        subject: t.Optional(t.String()),
        body: t.Optional(t.String({ description: "Email body (plain text)" })),
        html: t.Optional(t.String({ description: "Email body (HTML)" })),
        cc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        bcc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        replyTo: t.Optional(t.String()),
        threadId: t.Optional(t.String({ description: "Thread ID for replies" })),
      }),
      response: {
        201: DraftSummarySchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
      },
      detail: {
        summary: "Create draft",
        description: "Create a new draft message. Requires `mail:drafts` permission.",
        tags: ["Gmail - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Update draft
  .patch(
    "/drafts/:id",
    async ({ params, body, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:drafts")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:drafts",
        };
      }

      const result = await updateDraft(googleAccessToken!, params.id, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        html: body.html,
        cc: body.cc,
        bcc: body.bcc,
        replyTo: body.replyTo,
        threadId: body.threadId,
      });

      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft ID" }),
      }),
      body: t.Object({
        to: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        subject: t.Optional(t.String()),
        body: t.Optional(t.String()),
        html: t.Optional(t.String()),
        cc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        bcc: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        replyTo: t.Optional(t.String()),
        threadId: t.Optional(t.String()),
      }),
      response: {
        200: DraftSummarySchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Update draft",
        description: "Update an existing draft. Requires `mail:drafts` permission.",
        tags: ["Gmail - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Delete draft
  .delete(
    "/drafts/:id",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:drafts")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:drafts",
        };
      }

      await deleteDraft(googleAccessToken!, params.id);
      return { success: true };
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft ID" }),
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
        description: "Delete a draft. Requires `mail:drafts` permission.",
        tags: ["Gmail - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  )

  // Send draft
  .post(
    "/drafts/:id/send",
    async ({ params, googleAccessToken, permissions, set }) => {
      if (!hasPermission(permissions!, "google", "mail:drafts")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:drafts",
        };
      }

      const result = await sendDraft(googleAccessToken!, params.id);
      return result;
    },
    {
      mailAuth: true,
      params: t.Object({
        id: t.String({ description: "Draft ID" }),
      }),
      response: {
        200: SendMessageSchema,
        401: ErrorSchema,
        402: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Send draft",
        description: "Send a draft message. Requires `mail:drafts` permission.",
        tags: ["Gmail - Drafts"],
        security: [{ apiKey: [] }],
      },
    }
  );
