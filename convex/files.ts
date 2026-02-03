/**
 * Files Convex Functions
 *
 * This module defines all Convex queries and mutations for managing files and folders
 * within projects. All operations require authentication and verify project ownership.
 * Supports hierarchical folder structures with uniqueness validation.
 *
 * @module convex/files
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Get Files Query
 *
 * Fetches all files and folders for a specific project. Returns the complete
 * file tree including all nested items.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"projects">} args.projectId - The ID of the project to fetch files from
 * @returns {Promise<Doc<"files">[]>} Array of all files and folders in the project
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 *
 * @example
 * // From React component
 * const files = useQuery(api.files.getFiles, { projectId });
 *
 * if (!files) return <Spinner />;
 *
 * // Build tree structure from flat array
 * const rootFiles = files.filter(f => !f.parentId);
 *
 * @remarks
 * - Returns all files regardless of depth in folder hierarchy
 * - Client should filter by parentId to build tree structure
 * - Uses indexed query for optimal performance
 */
export const getFiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Get File Query
 *
 * Fetches a single file or folder by its ID. Verifies that the authenticated
 * user owns the parent project before returning the file.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"files">} args.fileId - The ID of the file or folder to fetch
 * @returns {Promise<Doc<"files">>} The requested file or folder document
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "File not found" - If file doesn't exist
 * @throws {Error} "Project not found" - If parent project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the parent project
 *
 * @example
 * // From React component
 * const file = useQuery(api.files.getFile, { fileId });
 *
 * if (!file) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h2>{file.name}</h2>
 *     {file.type === "file" && <pre>{file.content}</pre>}
 *   </div>
 * );
 *
 * @remarks
 * - Performs ownership verification via parent project
 * - Returns both files and folders
 * - Useful for file detail views or editors
 */
export const getFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.fileId);

    if (!file) {
      throw new Error("File not found");
    }

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return file;
  },
});

/**
 * Get Folder Contents Query
 *
 * Fetches the direct children of a folder (or root level if no parentId provided).
 * Results are automatically sorted with folders first, then files, both alphabetically.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"projects">} args.projectId - The ID of the project
 * @param {Id<"files">} [args.parentId] - The ID of the parent folder (undefined for root level)
 * @returns {Promise<Doc<"files">[]>} Sorted array of direct children
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 *
 * @example
 * // Get root level files
 * const rootFiles = useQuery(api.files.getFolderContents, {
 *   projectId,
 *   parentId: undefined
 * });
 *
 * @example
 * // Get children of a specific folder
 * const folderContents = useQuery(api.files.getFolderContents, {
 *   projectId,
 *   parentId: folderId
 * });
 *
 * @remarks
 * Sorting Behavior:
 * - Folders are always listed before files
 * - Within each group (folders/files), items are sorted alphabetically by name
 * - Case-sensitive sorting using localeCompare
 *
 * Performance:
 * - Uses compound index (by_project_parent) for efficient queries
 * - Only fetches direct children, not entire subtree
 * - Ideal for lazy-loading folder contents in a tree view
 */
export const getFolderContents = query({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    //sort: folders first, then files, both alphabetically within each group
    return files.sort((a, b) => {
      // folders before files
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;

      //within each group, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Create File Mutation
 *
 * Creates a new text file in the specified location. Validates that no file
 * with the same name already exists in the target folder.
 *
 * @mutation
 * @param {Object} args - Mutation arguments
 * @param {Id<"projects">} args.projectId - The ID of the parent project
 * @param {Id<"files">} [args.parentId] - The ID of the parent folder (undefined for root)
 * @param {string} args.name - Name of the file including extension (e.g., "index.ts")
 * @param {string} args.content - Text content of the file
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 * @throws {Error} "File with same name already exists in this folder" - If name collision occurs
 *
 * @example
 * const createFile = useMutation(api.files.createFile);
 *
 * await createFile({
 *   projectId,
 *   parentId: folderId,
 *   name: "index.ts",
 *   content: "console.log('Hello, world!');"
 * });
 *
 * @remarks
 * - Only for text files (uses content field, not storageId)
 * - Name must be unique within the parent folder
 * - Automatically sets updatedAt timestamp
 * - Sets type to "file" automatically
 * - For binary files, use a different approach with storageId
 */
export const createFile = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    //check if file with same name already exists in the same folder

    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const existing = siblings.find(
      (file) => file.name === args.name && file.type === "file"
    );

    if (existing) {
      throw new Error("File with same name already exists in this folder");
    }

    const now = Date.now();
    await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: args.name,
      type: "file",
      content: args.content,
      updatedAt: now,
    });

    await ctx.db.patch("projects", project._id, {
      updatedAt: now,
    });
  },
});

/**
 * Create Folder Mutation
 *
 * Creates a new folder in the specified location. Validates that no folder
 * with the same name already exists in the target folder.
 *
 * @mutation
 * @param {Object} args - Mutation arguments
 * @param {Id<"projects">} args.projectId - The ID of the parent project
 * @param {Id<"files">} [args.parentId] - The ID of the parent folder (undefined for root)
 * @param {string} args.name - Name of the folder (e.g., "src", "components")
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 * @throws {Error} "Folder with same name already exists in this folder" - If name collision occurs
 *
 * @example
 * const createFolder = useMutation(api.files.createFolder);
 *
 * await createFolder({
 *   projectId,
 *   parentId: undefined, // Create at root level
 *   name: "src"
 * });
 *
 * @remarks
 * - Name must be unique within the parent folder
 * - Automatically sets updatedAt timestamp
 * - Sets type to "folder" automatically
 * - No content or storageId fields for folders
 * - Can be nested infinitely deep
 */
export const createFolder = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    //check if folder with same name already exists in the same folder

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const existing = files.find(
      (file) => file.name === args.name && file.type === "folder"
    );

    if (existing) {
      throw new Error("Folder with same name already exists in this folder");
    }

    const now = Date.now();
    await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: args.name,
      type: "folder",
      updatedAt: now,
    });

    await ctx.db.patch("projects", args.projectId, {
      updatedAt: now,
    });
  },
});

/**
 * Rename File Mutation
 *
 * Renames a file or folder. Validates that no sibling with the same name
 * and type already exists in the same parent folder.
 *
 * @mutation
 * @param {Object} args - Mutation arguments
 * @param {Id<"files">} args.id - The ID of the file or folder to rename
 * @param {string} args.newName - The new name for the file or folder
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "File not found" - If file doesn't exist
 * @throws {Error} "Project not found" - If parent project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 * @throws {Error} "A {type} with the same name already exists in this folder" - If name collision occurs
 *
 * @example
 * const renameFile = useMutation(api.files.renameFile);
 *
 * await renameFile({
 *   id: fileId,
 *   newName: "new-name.ts"
 * });
 *
 * @example
 * // Rename a folder
 * await renameFile({
 *   id: folderId,
 *   newName: "components"
 * });
 *
 * @remarks
 * - Works for both files and folders
 * - New name must be unique among siblings of the same type
 * - Automatically updates updatedAt timestamp
 * - Name validation prevents files/folders with identical names in same location
 * - Does not check for name collisions across different types (file vs folder)
 */
export const renameFile = mutation({
  args: {
    id: v.id("files"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    //check if a file with the new name already exists in the same parent folder
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId)
      )
      .collect();

    const existing = siblings.find(
      (sibling) =>
        sibling.name === args.newName &&
        sibling.type === file.type &&
        sibling._id !== args.id
    );

    if (existing) {
      throw new Error(
        `A ${file.type} with the same name already exists in this folder`
      );
    }

    // update the file name
    await ctx.db.patch("files", args.id, {
      name: args.newName,
      updatedAt: Date.now(),
    });

    await ctx.db.patch("projects", project._id, {
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete File Mutation
 *
 * Permanently deletes a file or folder. If the target is a folder, recursively
 * deletes all nested files and folders within it. Also removes associated storage
 * objects if they exist.
 *
 * @mutation
 * @param {Object} args - Mutation arguments
 * @param {Id<"files">} args.id - The ID of the file or folder to delete
 * @returns {Promise<void>}
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "File not found" - If file doesn't exist
 * @throws {Error} "Project not found" - If parent project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 *
 * @example
 * const deleteFile = useMutation(api.files.deleteFile);
 *
 * // Delete a file
 * await deleteFile({ id: fileId });
 *
 * @example
 * // Delete a folder (recursively deletes all contents)
 * await deleteFile({ id: folderId });
 *
 * @remarks
 * Recursive Deletion:
 * - When deleting a folder, all nested files and folders are deleted
 * - Uses depth-first traversal to delete children before parents
 * - Storage objects (storageId) are cleaned up automatically
 *
 * Storage Cleanup:
 * - Automatically deletes associated storage objects for binary files
 * - Text files (content field) don't have storage objects to clean
 *
 * ⚠️ Warning:
 * - This operation is permanent and cannot be undone
 * - Deleting a folder with many nested items may take time
 * - Ensure proper ownership validation before deletion
 */
export const deleteFile = mutation({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    //recursively delete all child files/folders if folder
    const deleteRecursively = async (fileId: Id<"files">) => {
      const item = await ctx.db.get("files", fileId);

      if (!item) return;

      // if its a folder, delete children first
      if (item.type === "folder") {
        const children = await ctx.db
          .query("files")
          .withIndex("by_project_parent", (q) =>
            q.eq("projectId", item.projectId).eq("parentId", item._id)
          )
          .collect();

        for (const child of children) {
          await deleteRecursively(child._id);
        }
      }

      //delete storage file if exists
      if (item.storageId) {
        await ctx.storage.delete(item.storageId as Id<"_storage">);
      }

      // delete the file/folder itself
      await ctx.db.delete("files", fileId);
    };

    await deleteRecursively(args.id);

    await ctx.db.patch("projects", project._id, {
      updatedAt: Date.now(),
    });
  },
});

export const updateFile = mutation({
  args: {
    id: v.id("files"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    await ctx.db.patch("files", args.id, {
      content: args.content,
      updatedAt: now,
    });

    await ctx.db.patch("projects", project._id, {
      updatedAt: now,
    });
  },
});
