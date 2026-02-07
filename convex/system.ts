import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const validateInternalKey = (key: string) => {
  const expectedKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

  if (!expectedKey) {
    throw new Error("Internal Key not configured");
  }

  if (key !== expectedKey) {
    throw new Error("Unauthorized");
  }
};

export const getConversationById = query({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
  },
  handler: async (ctx, { conversationId, internalKey }) => {
    validateInternalKey(internalKey);

    return await ctx.db.get("conversations", conversationId);
  },
});

export const createMessage = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("canceled")
      )
    ),
  },
  handler: async (
    ctx,
    { internalKey, conversationId, projectId, role, content, status }
  ) => {
    validateInternalKey(internalKey);

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      projectId,
      role,
      content,
      status,
    });

    await ctx.db.patch("conversations", conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const updateMessageContent = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, { internalKey, messageId, content }) => {
    validateInternalKey(internalKey);

    await ctx.db.patch("messages", messageId, {
      content,
      status: "completed" as const,
    });
  },
});
