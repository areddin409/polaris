/**
 * Convex Database Schema
 *
 * Defines the structure and relationships of all database tables in the application.
 * This schema is used by Convex to validate data and generate TypeScript types.
 *
 * @module convex/schema
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Projects Table
   *
   * Stores user projects with their metadata and import/export status.
   * Each project is owned by a single user and can contain multiple files.
   *
   * @table projects
   *
   * @field {string} name - Display name of the project
   * @field {string} ownerId - Clerk user ID of the project owner (from identity.subject)
   * @field {number} updatedAt - Unix timestamp in milliseconds of last update
   * @field {string} [importStatus] - Current status of GitHub import operation
   *   - "importing" - Import is in progress
   *   - "completed" - Import finished successfully
   *   - "failed" - Import encountered an error
   * @field {string} [exportStatus] - Current status of GitHub export operation
   *   - "exporting" - Export is in progress
   *   - "completed" - Export finished successfully
   *   - "failed" - Export encountered an error
   *   - "canceled" - Export was canceled by user
   * @field {string} [exportRepoUrl] - GitHub repository URL where project was exported
   *
   * @index by_owner - Indexed by ownerId for efficient user project queries
   *
   * @example
   * // Query projects by owner
   * const projects = await ctx.db
   *   .query("projects")
   *   .withIndex("by_owner", (q) => q.eq("ownerId", userId))
   *   .collect();
   *
   * @example
   * // Create a new project
   * const projectId = await ctx.db.insert("projects", {
   *   name: "My Project",
   *   ownerId: identity.subject,
   *   updatedAt: Date.now(),
   * });
   */
  projects: defineTable({
    name: v.string(),
    ownerId: v.string(),
    updatedAt: v.number(),
    importStatus: v.optional(
      v.union(
        v.literal("importing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    exportStatus: v.optional(
      v.union(
        v.literal("exporting"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("canceled")
      )
    ),
    exportRepoUrl: v.optional(v.string()),
  }).index("by_owner", ["ownerId"]),

  /**
   * Files Table
   *
   * Stores the file system structure for projects, supporting both files and folders
   * in a hierarchical tree structure. Handles both text and binary files.
   *
   * @table files
   *
   * @field {Id<"projects">} projectId - Reference to the parent project
   * @field {Id<"files">} [parentId] - Reference to parent folder (undefined for root-level items)
   * @field {string} name - File or folder name (including extension for files)
   * @field {string} type - Type of file system entry
   *   - "file" - Regular file
   *   - "folder" - Directory/folder
   * @field {string} [content] - Text content (only for text files, mutually exclusive with storageId)
   * @field {string} [storageId] - Convex storage ID for binary files (mutually exclusive with content)
   * @field {number} updatedAt - Unix timestamp in milliseconds of last modification
   *
   * @index by_project - Indexed by projectId for efficient project file tree queries
   * @index by_parent - Indexed by parentId for efficient child queries
   * @index by_project_parent - Compound index on [projectId, parentId] for efficient folder content queries
   *
   * @example
   * // Query all files in a project
   * const files = await ctx.db
   *   .query("files")
   *   .withIndex("by_project", (q) => q.eq("projectId", projectId))
   *   .collect();
   *
   * @example
   * // Query children of a specific folder
   * const children = await ctx.db
   *   .query("files")
   *   .withIndex("by_project_parent", (q) =>
   *     q.eq("projectId", projectId).eq("parentId", folderId)
   *   )
   *   .collect();
   *
   * @example
   * // Create a folder
   * const folderId = await ctx.db.insert("files", {
   *   projectId: projectId,
   *   name: "src",
   *   type: "folder",
   *   updatedAt: Date.now(),
   * });
   *
   * @example
   * // Create a text file
   * const fileId = await ctx.db.insert("files", {
   *   projectId: projectId,
   *   parentId: folderId,
   *   name: "index.ts",
   *   type: "file",
   *   content: "console.log('Hello, world!');",
   *   updatedAt: Date.now(),
   * });
   *
   * @example
   * // Create a binary file (e.g., image)
   * const imageId = await ctx.db.insert("files", {
   *   projectId: projectId,
   *   parentId: folderId,
   *   name: "logo.png",
   *   type: "file",
   *   storageId: storageId, // ID from ctx.storage.store()
   *   updatedAt: Date.now(),
   * });
   *
   * @remarks
   * File System Structure:
   * - Root-level files/folders have no parentId (undefined)
   * - Nested files/folders reference their parent via parentId
   * - Tree structure allows unlimited nesting depth
   *
   * File Content Storage:
   * - Text files: Use `content` field to store directly in database
   * - Binary files: Use `storageId` to reference Convex file storage
   * - Never populate both `content` and `storageId` for the same file
   * - Folders have neither `content` nor `storageId`
   *
   * Performance Considerations:
   * - Use by_project index to fetch all files for a project
   * - Use by_project_parent index to fetch direct children of a folder
   * - Consider pagination for projects with large file counts
   */
  files: defineTable({
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),

    name: v.string(),
    type: v.union(v.literal("file"), v.literal("folder")),
    content: v.optional(v.string()), // Text files only
    storageId: v.optional(v.string()), // Binary files only
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentId"])
    .index("by_project_parent", ["projectId", "parentId"]),

  /**
   * Conversations Table
   *
   * Stores AI chat conversations associated with projects. Each conversation
   * represents a thread of messages between the user and AI assistant within
   * the context of a specific project.
   *
   * @table conversations
   *
   * @field {Id<"projects">} projectId - Reference to the parent project this conversation belongs to
   * @field {string} title - Display title of the conversation (e.g., "Implement auth feature", "Debug API endpoint")
   * @field {number} updatedAt - Unix timestamp in milliseconds of last message or update
   *
   * @index by_project - Indexed by projectId for efficient project conversation queries
   *
   * @example
   * // Query all conversations for a project
   * const conversations = await ctx.db
   *   .query("conversations")
   *   .withIndex("by_project", (q) => q.eq("projectId", projectId))
   *   .order("desc") // Most recent first
   *   .collect();
   *
   * @example
   * // Create a new conversation
   * const conversationId = await ctx.db.insert("conversations", {
   *   projectId: projectId,
   *   title: "Add authentication",
   *   updatedAt: Date.now(),
   * });
   *
   * @remarks
   * - Conversations are scoped to projects for context-aware AI assistance
   * - updatedAt is updated when new messages are added to the conversation
   * - Deleting a project should cascade delete associated conversations
   */
  conversations: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  /**
   * Messages Table
   *
   * Stores individual messages within AI chat conversations. Messages alternate
   * between user prompts and AI assistant responses, with status tracking for
   * streaming and cancellation support.
   *
   * @table messages
   *
   * @field {Id<"conversations">} conversationId - Reference to the parent conversation
   * @field {Id<"projects">} projectId - Reference to the project (denormalized for efficient queries)
   * @field {string} role - Message author role
   *   - "user" - Message from the user
   *   - "assistant" - Message from the AI assistant
   * @field {string} content - Message text content (supports markdown for assistant messages)
   * @field {string} status - Message processing state
   *   - "processing" - AI is currently generating the response (for streaming)
   *   - "completed" - Message generation finished successfully
   *   - "canceled" - Message generation was canceled by user
   *
   * @index by_conversation - Indexed by conversationId for efficient message thread queries
   * @index by_project_status - Compound index on [projectId, status] for filtering active/processing messages
   *
   * @example
   * // Query all messages in a conversation
   * const messages = await ctx.db
   *   .query("messages")
   *   .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
   *   .order("asc") // Chronological order
   *   .collect();
   *
   * @example
   * // Create a user message
   * const messageId = await ctx.db.insert("messages", {
   *   conversationId: conversationId,
   *   projectId: projectId,
   *   role: "user",
   *   content: "How do I add authentication?",
   *   status: "completed", // User messages are always completed
   * });
   *
   * @example
   * // Create an AI assistant message (initially processing)
   * const assistantMessageId = await ctx.db.insert("messages", {
   *   conversationId: conversationId,
   *   projectId: projectId,
   *   role: "assistant",
   *   content: "", // Content streams in
   *   status: "processing",
   * });
   *
   * @example
   * // Find all processing messages in a project (e.g., for cleanup)
   * const processingMessages = await ctx.db
   *   .query("messages")
   *   .withIndex("by_project_status", (q) =>
   *     q.eq("projectId", projectId).eq("status", "processing")
   *   )
   *   .collect();
   *
   * @remarks
   * Message Flow:
   * - User messages: Created with status "completed"
   * - AI messages: Created with status "processing", updated to "completed"/"canceled"
   * - Content streaming: AI message content is progressively updated during generation
   *
   * Denormalization:
   * - projectId is denormalized from conversationId for efficient project-level queries
   * - Avoid joining through conversations table when filtering by project
   *
   * Performance Considerations:
   * - Use by_conversation index for rendering conversation threads
   * - Use by_project_status index for monitoring active AI generations
   * - Consider pagination for long conversation threads (50+ messages)
   */
  messages: defineTable({
    conversationId: v.id("conversations"),
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("canceled")
    ),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_project_status", ["projectId", "status"]),
});
