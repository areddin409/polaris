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
});
