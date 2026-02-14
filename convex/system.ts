/**
 * System Functions Module
 *
 * Internal API functions for server-to-server communication.
 * All functions require authentication via POLARIS_CONVEX_INTERNAL_KEY.
 *
 * These functions are designed for use by:
 * - Background job processors (Inngest functions)
 * - Internal services and API routes
 * - Server-side operations requiring elevated privileges
 *
 * @module convex/system
 *
 * @security
 * All functions validate against POLARIS_CONVEX_INTERNAL_KEY environment variable.
 * Never expose the internal key to client-side code.
 *
 * @example
 * ```typescript
 * // From a server-side API route or Inngest function
 * const message = await convex.mutation(api.system.createMessage, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY,
 *   conversationId: "...",
 *   projectId: "...",
 *   role: "assistant",
 *   content: "Generated response"
 * });
 * ```
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { RECENT_MESSAGES_LIMIT } from "../src/features/conversations/constants";
import { Id } from "./_generated/dataModel";

/**
 * Validates Internal API Key
 *
 * Security helper that verifies the provided key matches the
 * POLARIS_CONVEX_INTERNAL_KEY environment variable. Throws an
 * error if validation fails.
 *
 * @param {string} key - The internal key to validate
 * @throws {Error} "Internal Key not configured" if environment variable not set
 * @throws {Error} "Unauthorized" if key doesn't match expected value
 *
 * @remarks
 * This function should be called at the start of every system function
 * to ensure only authorized internal services can access these APIs.
 *
 * @example
 * ```typescript
 * export const internalFunction = mutation({
 *   handler: async (ctx, { internalKey, ...args }) => {
 *     validateInternalKey(internalKey); // Throws if invalid
 *     // Proceed with trusted operation...
 *   }
 * });
 * ```
 */
const validateInternalKey = (key: string) => {
  const expectedKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;

  if (!expectedKey) {
    throw new Error("Internal Key not configured");
  }

  if (key !== expectedKey) {
    throw new Error("Unauthorized");
  }
};

/**
 * Get Conversation By ID (Internal)
 *
 * Retrieves a conversation document by its ID. This is an internal
 * API that bypasses user authentication checks, intended for server-side
 * operations that need unrestricted access to conversation data.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Query arguments
 * @param {Id<"conversations">} args.conversationId - The conversation document ID
 * @param {string} args.internalKey - Internal API authentication key
 *
 * @returns {Promise<Doc<"conversations"> | null>} The conversation document or null if not found
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 * @throws {Error} "Internal Key not configured" if environment variable not set
 *
 * @example
 * ```typescript
 * // From Inngest background job
 * const conversation = await ctx.runQuery(api.system.getConversationById, {
 *   conversationId: ctx.event.data.conversationId,
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!
 * });
 * ```
 */
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

/**
 * Get Project By ID (Internal)
 *
 * Retrieves a project document by its ID. This is an internal
 * API that bypasses user authentication checks, intended for server-side
 * operations that need unrestricted access to project data.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param args - Query arguments
 * @returns The project document or null if not found
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 * @throws {Error} "Internal Key not configured" if environment variable not set
 *
 * @example
 * ```typescript
 * // From API route for authorization checks
 * const project = await convex.query(api.system.getProjectById, {
 *   projectId: "proj_123",
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!
 * });
 *
 * if (!project || project.ownerId !== userId) {
 *   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 * }
 * ```
 */
export const getProjectById = query({
  args: {
    projectId: v.id("projects"),
    internalKey: v.string(),
  },
  handler: async (ctx, { projectId, internalKey }) => {
    validateInternalKey(internalKey);

    return await ctx.db.get("projects", projectId);
  },
});

/**
 * Create Message (Internal)
 *
 * Creates a new message in a conversation and updates the conversation's
 * timestamp. This internal API is designed for background jobs and AI
 * generation systems to insert messages without user authentication.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {string} args.internalKey - Internal API authentication key
 * @param {Id<"conversations">} args.conversationId - Target conversation ID
 * @param {Id<"projects">} args.projectId - Associated project ID
 * @param {"user" | "assistant"} args.role - Message sender role
 * @param {string} args.content - Message text content
 * @param {"processing" | "completed" | "canceled"} [args.status] - Message status (optional)
 *
 * @returns {Promise<Id<"messages">>} The newly created message ID
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Automatically updates conversation's `updatedAt` timestamp
 * - Use `status: "processing"` for streaming/async AI responses
 * - Use `status: "completed"` for finalized messages
 *
 * @example
 * ```typescript
 * // AI assistant response generation
 * const messageId = await ctx.runMutation(api.system.createMessage, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   conversationId,
 *   projectId,
 *   role: "assistant",
 *   content: "Initial response...",
 *   status: "processing"
 * });
 *
 * // Later, update with final content via updateMessageContent
 * ```
 */
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

/**
 * Update Message Content (Internal)
 *
 * Updates the content of an existing message and marks it as completed.
 * Primarily used by AI streaming systems to update a message with the
 * final generated content after initial creation.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {string} args.internalKey - Internal API authentication key
 * @param {Id<"messages">} args.messageId - The message ID to update
 * @param {string} args.content - The new message content
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Automatically sets message status to "completed"
 * - Replaces entire content field (not incremental)
 * - Does NOT update conversation timestamp (use createMessage for that)
 *
 * @example
 * ```typescript
 * // Streaming AI workflow
 * // 1. Create placeholder message
 * const msgId = await createMessage({
 *   ...,
 *   content: "",
 *   status: "processing"
 * });
 *
 * // 2. Generate AI response (takes time)
 * const finalContent = await generateAIResponse();
 *
 * // 3. Update with final content
 * await ctx.runMutation(api.system.updateMessageContent, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   messageId: msgId,
 *   content: finalContent
 * });
 * ```
 */
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

/**
 * Update Message Status (Internal)
 *
 * Updates the status of an existing message without modifying its content.
 * Used to mark messages as "canceled" when AI generation is aborted, or to
 * reset status to "processing" for retry operations.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {string} args.internalKey - Internal API authentication key
 * @param {Id<"messages">} args.messageId - The message ID to update
 * @param {"processing" | "completed" | "canceled"} args.status - The new message status
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Does NOT update message content, only status field
 * - Does NOT update conversation timestamp
 * - Useful for cleanup jobs and error handling
 *
 * @example
 * ```typescript
 * // Mark stuck message as canceled
 * await ctx.runMutation(api.system.updateMessageStatus, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   messageId: stuckMessageId,
 *   status: "canceled"
 * });
 * ```
 */
export const updateMessageStatus = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("canceled")
    ),
  },
  handler: async (ctx, { internalKey, messageId, status }) => {
    validateInternalKey(internalKey);

    await ctx.db.patch("messages", messageId, {
      status,
    });
  },
});

/**
 * Get Processing Messages (Internal)
 *
 * Retrieves all messages with "processing" status for a specific project.
 * Used by monitoring systems and cleanup jobs to identify stuck or
 * incomplete AI generation tasks.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Query arguments
 * @param {Id<"projects">} args.projectId - The project to query messages for
 * @param {string} args.internalKey - Internal API authentication key
 *
 * @returns {Promise<Doc<"messages">[]>} Array of messages with "processing" status
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Uses compound index `by_project_status` for efficient querying
 * - Returns messages that may be actively streaming or potentially stuck
 * - Useful for cleanup jobs that mark abandoned processing messages as "canceled"
 *
 * @example
 * ```typescript
 * // Monitoring/cleanup job
 * const stuckMessages = await ctx.runQuery(api.system.getProcessingMessages, {
 *   projectId,
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!
 * });
 *
 * // Check if any messages have been processing for too long
 * const now = Date.now();
 * for (const msg of stuckMessages) {
 *   if (now - msg._creationTime > 5 * 60 * 1000) { // 5 minutes
 *     // Mark as canceled via another mutation
 *   }
 * }
 * ```
 */
export const getProcessingMessages = query({
  args: {
    projectId: v.id("projects"),
    internalKey: v.string(),
  },
  handler: async (ctx, { projectId, internalKey }) => {
    validateInternalKey(internalKey);

    return await ctx.db
      .query("messages")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", projectId).eq("status", "processing")
      )
      .collect();
  },
});

/**
 * Get Recent Messages (Internal)
 *
 * Retrieves the most recent messages from a conversation in chronological order.
 * Used by AI agents to build conversation context for generating responses.
 * Returns up to a specified limit (default from RECENT_MESSAGES_LIMIT constant).
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Query arguments
 * @param {Id<"conversations">} args.conversationId - The conversation to fetch messages from
 * @param {string} args.internalKey - Internal API authentication key
 * @param {number} [args.limit] - Maximum number of messages to return (defaults to RECENT_MESSAGES_LIMIT)
 *
 * @returns {Promise<Doc<"messages">[]>} Array of recent messages in chronological order (oldest to newest)
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Uses `by_conversation` index for efficient querying
 * - Returns messages in ascending order (oldest first)
 * - Slices from the end to get most recent messages
 * - Default limit prevents overloading AI context windows
 *
 * @example
 * ```typescript
 * // Get last 20 messages for AI context
 * const recentMessages = await ctx.runQuery(api.system.getRecentMessages, {
 *   conversationId,
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   limit: 20
 * });
 *
 * // Build context for AI agent
 * const context = recentMessages.map(msg => ({
 *   role: msg.role,
 *   content: msg.content
 * }));
 * ```
 */
export const getRecentMessages = query({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { conversationId, internalKey, limit = RECENT_MESSAGES_LIMIT }
  ) => {
    validateInternalKey(internalKey);

    const message = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("asc")
      .collect();

    return message.slice(-limit);
  },
});

/**
 * Update Conversation Title (Internal)
 *
 * Updates the title of a conversation and refreshes its timestamp.
 * Typically used after AI analyzes the first user message to generate
 * a descriptive title automatically.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {Id<"conversations">} args.conversationId - The conversation to update
 * @param {string} args.internalKey - Internal API authentication key
 * @param {string} args.title - The new title for the conversation
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Automatically updates conversation's `updatedAt` timestamp
 * - Commonly called from Inngest jobs after AI generates a title
 * - Title should be descriptive of conversation topic
 *
 * @example
 * ```typescript
 * // From AI title generation job
 * const generatedTitle = await generateTitle(firstUserMessage);
 *
 * await ctx.runMutation(api.system.updateConversationTitle, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   conversationId,
 *   title: generatedTitle
 * });
 * ```
 */
export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { conversationId, internalKey, title }) => {
    validateInternalKey(internalKey);

    await ctx.db.patch("conversations", conversationId, {
      title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get Project Files (Internal)
 *
 * Retrieves all files (including folders) for a specific project.
 * Used by AI agent tools to list available files when generating
 * code or analyzing project structure.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Query arguments
 * @param {Id<"projects">} args.projectId - The project to fetch files from
 * @param {string} args.internalKey - Internal API authentication key
 *
 * @returns {Promise<Doc<"files">[]>} Array of all files and folders in the project
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Uses `by_project` index for efficient querying
 * - Returns both files and folders (check `type` field)
 * - Files have `content` field, folders have `parentId` relationships
 * - Useful for AI agent 'ListFiles' tool implementation
 *
 * @example
 * ```typescript
 * // AI agent tool: List all files in project
 * const files = await ctx.runQuery(api.system.getProjectFiles, {
 *   projectId,
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!
 * });
 *
 * // Filter by type
 * const sourceFiles = files.filter(f => f.type === 'file');
 * const folders = files.filter(f => f.type === 'folder');
 * ```
 */
export const getProjectFiles = query({
  args: {
    projectId: v.id("projects"),
    internalKey: v.string(),
  },
  handler: async (ctx, { projectId, internalKey }) => {
    validateInternalKey(internalKey);

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

/**
 * Get File By ID (Internal)
 *
 * Retrieves a single file document by its ID. Used by AI agents
 * to read file content when generating code or analyzing existing files.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Query arguments
 * @param {Id<"files">} args.fileId - The file document ID to retrieve
 * @param {string} args.internalKey - Internal API authentication key
 *
 * @returns {Promise<Doc<"files"> | null>} The file document or null if not found
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Returns null if file doesn't exist (no error thrown)
 * - For text files, `content` field contains file text
 * - For binary files, `storageId` field references Convex storage
 * - Never populated both `content` and `storageId`
 *
 * @example
 * ```typescript
 * // AI agent tool: Read file content
 * const file = await ctx.runQuery(api.system.getFileById, {
 *   fileId: "files|abc123",
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!
 * });
 *
 * if (file && file.content) {
 *   // Process file content
 *   analyzeCode(file.content);
 * }
 * ```
 */
export const getFileById = query({
  args: {
    fileId: v.id("files"),
    internalKey: v.string(),
  },
  handler: async (ctx, { fileId, internalKey }) => {
    validateInternalKey(internalKey);

    return await ctx.db.get("files", fileId);
  },
});

/**
 * Update File (Internal)
 *
 * Updates the content of an existing text file and refreshes its timestamp.
 * Used by AI agents to modify files when generating or refactoring code.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {Id<"files">} args.fileId - The file document ID to update
 * @param {string} args.internalKey - Internal API authentication key
 * @param {string} args.content - The new content for the file
 *
 * @returns {Promise<Id<"files">>} The updated file ID
 *
 * @throws {Error} "File not found" if file doesn't exist
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Validates file exists before updating
 * - Automatically updates file's `updatedAt` timestamp
 * - Only works for text files (those with `content` field)
 * - Replaces entire file content (not incremental)
 * - For binary files, use Convex storage operations instead
 *
 * @example
 * ```typescript
 * // AI agent tool: Write generated code to file
 * const generatedCode = await generateCode(prompt);
 *
 * await ctx.runMutation(api.system.updateFile, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   fileId: targetFileId,
 *   content: generatedCode
 * });
 * ```
 */
export const updateFile = mutation({
  args: {
    fileId: v.id("files"),
    internalKey: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { fileId, internalKey, content }) => {
    validateInternalKey(internalKey);

    const file = await ctx.db.get("files", fileId);

    if (!file) {
      throw new Error("File not found");
    }

    await ctx.db.patch("files", fileId, {
      content,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

/**
 * Create File (Internal)
 *
 * Creates a new text file in a project with the specified content.
 * Validates that no file with the same name exists in the target folder.
 * Used by AI agents to create new files when scaffolding projects or generating code.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {Id<"projects">} args.projectId - The project to create the file in
 * @param {string} args.internalKey - Internal API authentication key
 * @param {string} args.name - The file name (e.g., "index.ts", "README.md")
 * @param {string} args.content - The initial file content
 * @param {Id<"files">} [args.parentId] - Parent folder ID (undefined for root level)
 *
 * @returns {Promise<Id<"files">>} The newly created file ID
 *
 * @throws {Error} "File with the same name already exists in this folder" if duplicate found
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Automatically sets file type to "file"
 * - Validates uniqueness within parent folder
 * - Use `parentId: undefined` to create at project root
 * - Sets `updatedAt` timestamp to current time
 * - For creating multiple files, use `createFiles` instead for better performance
 *
 * @example
 * ```typescript
 * // AI agent tool: Create a new TypeScript file
 * const fileId = await ctx.runMutation(api.system.createFile, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   projectId,
 *   name: "config.ts",
 *   content: "export default { apiKey: '...' };",
 *   parentId: srcFolderId
 * });
 * ```
 */
export const createFile = mutation({
  args: {
    projectId: v.id("projects"),
    internalKey: v.string(),
    name: v.string(),
    content: v.string(),
    parentId: v.optional(v.id("files")),
  },
  handler: async (ctx, { projectId, internalKey, name, content, parentId }) => {
    validateInternalKey(internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", projectId).eq("parentId", parentId)
      )
      .collect();

    const existing = files.find((f) => f.name === name && f.type === "file");

    if (existing) {
      throw new Error("File with the same name already exists in this folder");
    }

    const fileId = await ctx.db.insert("files", {
      projectId,
      name,
      content,
      type: "file",
      parentId,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

/**
 * Create Files (Internal)
 *
 * Creates multiple text files in a single operation. Validates each file name
 * for uniqueness and returns results for all files, including errors for duplicates.
 * Optimized for AI agent bulk file creation when scaffolding projects.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {string} args.internalKey - Internal API authentication key
 * @param {Id<"projects">} args.projectId - The project to create files in
 * @param {Id<"files">} [args.parentId] - Parent folder ID (undefined for root level)
 * @param {Array<{name: string, content: string}>} args.files - Array of files to create
 *
 * @returns {Promise<Array<{name: string, fileId: string, error?: string}>>}
 *          Results array with fileId or error for each file
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Does NOT throw on duplicate files - returns error in result object instead
 * - Continues processing remaining files even if some fail
 * - For duplicates, returns existing file ID with error message
 * - All successful files get `updatedAt` timestamp set to current time
 * - More efficient than calling `createFile` multiple times
 * - Useful for AI agent 'CreateFiles' tool that scaffolds entire directories
 *
 * @example
 * ```typescript
 * // AI agent tool: Create multiple project files at once
 * const results = await ctx.runMutation(api.system.createFiles, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   projectId,
 *   parentId: srcFolderId,
 *   files: [
 *     { name: "index.ts", content: "export * from './app';" },
 *     { name: "app.ts", content: "export const app = () => {};" },
 *     { name: "types.ts", content: "export type Config = {};" }
 *   ]
 * });
 *
 * // Check results
 * const failed = results.filter(r => r.error);
 * const succeeded = results.filter(r => !r.error);
 * ```
 */
export const createFiles = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    files: v.array(
      v.object({
        name: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, { projectId, internalKey, files, parentId }) => {
    validateInternalKey(internalKey);

    const existingFiles = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", projectId).eq("parentId", parentId)
      )
      .collect();

    const results: { name: string; fileId: string; error?: string }[] = [];

    for (const file of files) {
      const { name, content } = file;
      const existing = existingFiles.find(
        (f) => f.name === name && f.type === "file"
      );

      if (existing) {
        results.push({
          name,
          fileId: existing._id,
          error: "File with the same name already exists in this folder",
        });
        continue;
      }

      const fileId = await ctx.db.insert("files", {
        projectId,
        name,
        content,
        type: "file",
        parentId,
        updatedAt: Date.now(),
      });
      results.push({ name, fileId });
    }

    return results;
  },
});

/**
 * Create Folder (Internal)
 *
 * Creates a new folder in a project's file hierarchy.
 * Validates that no folder with the same name exists in the target location.
 * Used by AI agents to organize files when scaffolding project structures.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {string} args.internalKey - Internal API authentication key
 * @param {Id<"projects">} args.projectId - The project to create the folder in
 * @param {string} args.name - The folder name (e.g., "src", "components", "utils")
 * @param {Id<"files">} [args.parentId] - Parent folder ID (undefined for root level)
 *
 * @returns {Promise<Id<"files">>} The newly created folder ID
 *
 * @throws {Error} "Folder with the same name already exists in this folder" if duplicate found
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Automatically sets file type to "folder"
 * - Validates uniqueness within parent folder
 * - Folders do not have `content` field (only files do)
 * - Use `parentId: undefined` to create at project root
 * - Sets `updatedAt` timestamp to current time
 * - For creating multiple folders, use `createFolders` for better performance
 *
 * @example
 * ```typescript
 * // AI agent tool: Create a components folder
 * const folderId = await ctx.runMutation(api.system.createFolder, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   projectId,
 *   name: "components",
 *   parentId: srcFolderId
 * });
 *
 * // Create nested folder structure
 * const utilsId = await createFolder({ name: "utils", parentId: srcFolderId });
 * const helpersId = await createFolder({ name: "helpers", parentId: utilsId });
 * ```
 */
export const createFolder = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    name: v.string(),
    parentId: v.optional(v.id("files")),
  },
  handler: async (ctx, { projectId, internalKey, name, parentId }) => {
    validateInternalKey(internalKey);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", projectId).eq("parentId", parentId)
      )
      .collect();

    const existing = files.find((f) => f.name === name && f.type === "folder");

    if (existing) {
      throw new Error(
        "Folder with the same name already exists in this folder"
      );
    }

    const folderId = await ctx.db.insert("files", {
      projectId,
      name,
      type: "folder",
      parentId,
      updatedAt: Date.now(),
    });

    return folderId;
  },
});

/**
 * Create Folders (Internal)
 *
 * Creates multiple folders in a single operation. Validates each folder name
 * for uniqueness and returns results for all folders, including errors for duplicates.
 * Optimized for AI agent bulk folder creation when scaffolding project structures.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {string} args.internalKey - Internal API authentication key
 * @param {Id<"projects">} args.projectId - The project to create folders in
 * @param {Id<"files">} [args.parentId] - Parent folder ID (undefined for root level)
 * @param {Array<{name: string}>} args.folders - Array of folder names to create
 *
 * @returns {Promise<Array<{name: string, folderId: string, error?: string}>>}
 *          Results array with folderId or error for each folder
 *
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Does NOT throw on duplicate folders - returns error in result object instead
 * - Continues processing remaining folders even if some fail
 * - For duplicates, returns existing folder ID with error message
 * - All successful folders get `updatedAt` timestamp set to current time
 * - More efficient than calling `createFolder` multiple times
 * - Useful for AI agents scaffolding entire project directory structures
 * - Does not create nested structures - all folders created at same parent level
 *
 * @example
 * ```typescript
 * // AI agent tool: Create standard project directory structure
 * const results = await ctx.runMutation(api.system.createFolders, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   projectId,
 *   parentId: undefined, // Root level
 *   folders: [
 *     { name: "src" },
 *     { name: "public" },
 *     { name: "tests" },
 *     { name: "docs" }
 *   ]
 * });
 *
 * // Get the src folder ID for creating subfolders
 * const srcFolder = results.find(r => r.name === "src" && !r.error);
 * if (srcFolder) {
 *   // Create subfolders in src/
 *   await createFolders({
 *     projectId,
 *     parentId: srcFolder.folderId,
 *     folders: [{ name: "components" }, { name: "utils" }]
 *   });
 * }
 * ```
 */
export const createFolders = mutation({
  args: {
    internalKey: v.string(),
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    folders: v.array(
      v.object({
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, { projectId, internalKey, folders, parentId }) => {
    validateInternalKey(internalKey);

    const existingFiles = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", projectId).eq("parentId", parentId)
      )
      .collect();

    const results: { name: string; folderId: string; error?: string }[] = [];

    for (const folder of folders) {
      const { name } = folder;
      const existing = existingFiles.find(
        (f) => f.name === name && f.type === "folder"
      );

      if (existing) {
        results.push({
          name,
          folderId: existing._id,
          error: "Folder with the same name already exists in this folder",
        });
        continue;
      }

      const folderId = await ctx.db.insert("files", {
        projectId,
        name,
        type: "folder",
        parentId,
        updatedAt: Date.now(),
      });
      results.push({ name, folderId });
    }

    return results;
  },
});

/**
 * Rename File (Internal)
 *
 * Renames a file or folder while validating that the new name doesn't
 * conflict with existing items in the same parent folder. Used by AI
 * agents to organize and restructure project files.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {Id<"files">} args.fileId - The file or folder ID to rename
 * @param {string} args.internalKey - Internal API authentication key
 * @param {string} args.newName - The new name for the file/folder
 *
 * @returns {Promise<Id<"files">>} The renamed file ID
 *
 * @throws {Error} "File not found" if file doesn't exist
 * @throws {Error} "A {type} with the name '{newName}' already exists" if duplicate found
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - Validates uniqueness within the same parent folder
 * - Checks both file type and name to prevent conflicts
 * - Excludes the file being renamed from conflict check
 * - Automatically updates file's `updatedAt` timestamp
 * - Works for both files and folders
 *
 * @example
 * ```typescript
 * // AI agent tool: Rename a file
 * await ctx.runMutation(api.system.renameFile, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   fileId: "files|abc123",
 *   newName: "config.production.ts"
 * });
 *
 * // Rename folder
 * await ctx.runMutation(api.system.renameFile, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   fileId: folderId,
 *   newName: "components-v2"
 * });
 * ```
 */
export const renameFile = mutation({
  args: {
    fileId: v.id("files"),
    internalKey: v.string(),
    newName: v.string(),
  },
  handler: async (ctx, { fileId, internalKey, newName }) => {
    validateInternalKey(internalKey);

    const file = await ctx.db.get("files", fileId);

    if (!file) {
      throw new Error("File not found");
    }

    // check if a file with the new name already exists in the same parent folder
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId)
      )
      .collect();

    const existing = siblings.find(
      (sibling) =>
        sibling.name === newName &&
        sibling.type === file.type &&
        sibling._id !== fileId
    );

    if (existing) {
      throw new Error(
        `A ${file.type} with the name "${newName}" already exists in this folder`
      );
    }

    await ctx.db.patch("files", fileId, {
      name: newName,
      updatedAt: Date.now(),
    });

    return fileId;
  },
});

/**
 * Delete File (Internal)
 *
 * Recursively deletes a file or folder and all its descendants. For folders,
 * deletes all nested children before removing the folder itself. Also removes
 * associated binary storage files. Used by AI agents when cleaning up or
 * restructuring projects.
 *
 * @internal
 * @security Requires valid internal key
 *
 * @param {Object} args - Mutation arguments
 * @param {Id<"files">} args.fileId - The file or folder ID to delete
 * @param {string} args.internalKey - Internal API authentication key
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} "File not found" if file doesn't exist
 * @throws {Error} "Unauthorized" if internal key is invalid
 *
 * @remarks
 * - **Recursively deletes**: For folders, all nested children are deleted first
 * - **Storage cleanup**: Deletes binary files from Convex storage via `storageId`
 * - **Order matters**: Children deleted before parents to maintain referential integrity
 * - **No rollback**: Deletion is permanent and cannot be undone
 * - **Performance**: Large folder trees may take time to process
 *
 * @example
 * ```typescript
 * // AI agent tool: Delete a single file
 * await ctx.runMutation(api.system.deleteFile, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   fileId: "files|abc123"
 * });
 *
 * // Delete entire folder with all contents
 * await ctx.runMutation(api.system.deleteFile, {
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY!,
 *   fileId: oldComponentsFolderId // Recursively deletes all nested files/folders
 * });
 * ```
 */
export const deleteFile = mutation({
  args: {
    fileId: v.id("files"),
    internalKey: v.string(),
  },
  handler: async (ctx, { fileId, internalKey }) => {
    validateInternalKey(internalKey);

    const file = await ctx.db.get("files", fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Recursively delete file/folder and all descendants
    const deleteRecursively = async (id: typeof fileId) => {
      const item = await ctx.db.get("files", id);
      if (!item) return;

      // if its a folder, delete all children first
      if (item.type === "folder") {
        const children = await ctx.db
          .query("files")
          .withIndex("by_project_parent", (q) =>
            q.eq("projectId", item.projectId).eq("parentId", id)
          )
          .collect();

        for (const child of children) {
          await deleteRecursively(child._id);
        }
      }

      //delete storage file if it exists
      if (item.storageId) {
        await ctx.storage.delete(item.storageId as Id<"_storage">);
      }

      // delete the file/folder itself
      await ctx.db.delete("files", id);
    };

    await deleteRecursively(fileId);
  },
});
