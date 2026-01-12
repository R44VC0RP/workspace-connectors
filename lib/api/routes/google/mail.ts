import { Elysia, t } from "elysia";

import { verifyApiKey, getUserGoogleTokens, hasPermission } from "@/lib/api/auth";
import {
  listMessages,
  getMessage,
  sendMessage,
} from "@/lib/services/google/gmail";

// Response schemas for OpenAPI documentation
const MessageSchema = t.Object({
  id: t.String(),
  threadId: t.String(),
  subject: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  date: t.Optional(t.String()),
  snippet: t.Optional(t.String()),
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
});

const SendMessageSchema = t.Object({
  id: t.String(),
  threadId: t.String(),
});

const ErrorSchema = t.Object({
  error: t.String(),
  message: t.String(),
});

/**
 * Gmail auth macro - validates API key and retrieves Google access token
 */
const mailAuth = new Elysia({ name: "mail-auth" }).macro({
  mailAuth: {
    async resolve({ headers, status }) {
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

      // Check for mail permissions
      const hasRead = hasPermission(result.data.permissions, "google", "mail:read");
      const hasSend = hasPermission(result.data.permissions, "google", "mail:send");

      if (!hasRead && !hasSend) {
        return status(403);
      }

      // Get Google tokens
      const tokens = await getUserGoogleTokens(result.data.userId);
      if (!tokens?.accessToken) {
        return status(401);
      }

      return {
        googleAccessToken: tokens.accessToken,
        permissions: result.data.permissions,
        userId: result.data.userId,
      };
    },
  },
});

export const googleMailRoutes = new Elysia({ prefix: "/google/mail" })
  .use(mailAuth)
  // List messages
  .get(
    "/messages",
    async ({ query, googleAccessToken }) => {
      const labelIds = query.labelIds
        ? query.labelIds.split(",").map((l) => l.trim())
        : undefined;

      const result = await listMessages(googleAccessToken, {
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
        403: ErrorSchema,
      },
      detail: {
        summary: "List email messages",
        description: "Retrieve a list of email messages from Gmail",
        tags: ["Gmail"],
        security: [{ apiKey: [] }],
      },
    }
  )
  // Get single message
  .get(
    "/messages/:id",
    async ({ params, googleAccessToken, set }) => {
      const message = await getMessage(googleAccessToken, params.id);

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
        403: ErrorSchema,
        404: ErrorSchema,
      },
      detail: {
        summary: "Get email message",
        description: "Retrieve a specific email message by ID",
        tags: ["Gmail"],
        security: [{ apiKey: [] }],
      },
    }
  )
  // Send message
  .post(
    "/messages",
    async ({ body, googleAccessToken, permissions, set }) => {
      // Check send permission
      if (!hasPermission(permissions, "google", "mail:send")) {
        set.status = 403;
        return {
          error: "forbidden",
          message: "Missing permission: google:mail:send",
        };
      }

      const result = await sendMessage(googleAccessToken, {
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
        403: ErrorSchema,
      },
      detail: {
        summary: "Send email",
        description: "Send a new email message",
        tags: ["Gmail"],
        security: [{ apiKey: [] }],
      },
    }
  );
