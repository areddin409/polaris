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
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyAuth } from "./auth";
import { validateName, verifyProjectOwnership } from "./utils";
import { Id, Doc } from "./_generated/dataModel";

/**
  }

  if (project.ownerId !== identity.subject) {
    throw new Error("Unauthorized");
  }

  return { identity, project };
}

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
    await verifyProjectOwnership(ctx, args.projectId);

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
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    await verifyProjectOwnership(ctx, file.projectId);

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
    await verifyProjectOwnership(ctx, args.projectId);

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
 * Get File Path Query
 *
 * Builds the full path to a file or folder by traversing up the parent chain
 * from the target item to the root. Returns an ordered array of ancestor items
 * that can be used to construct breadcrumb navigation.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"files">} args.id - The ID of the file or folder to get the path for
 * @returns {Promise<Array<{_id: Id<"files">, name: string}>>} Ordered array from root to target
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "File not found" - If the specified file doesn't exist
 * @throws {Error} "Project not found" - If the file's project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 *
 * @example
 * // Get path for a nested file: src/components/button.tsx
 * const path = await getFilePath({ id: buttonFileId });
 * // Returns: [
 * //   { _id: "src_id", name: "src" },
 * //   { _id: "components_id", name: "components" },
 * //   { _id: "button_id", name: "button.tsx" }
 * // ]
 *
 * @example
 * // Render as breadcrumbs
 * path.map((item, i) => (
 *   <span key={item._id}>
 *     {i > 0 && " > "}
 *     {item.name}
 *   </span>
 * ))
 *
 * @remarks
 * - Traverses up the file tree via `parentId` references
 * - Always includes the target file/folder as the last element
 * - Root-level items return an array with a single element (themselves)
 * - Path is ordered from root to target (left to right in breadcrumbs)
 * - Useful for breadcrumb navigation, file path display, and contextual UI
 */
export const getFilePath = query({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
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

    const path: { _id: Id<"files">; name: string }[] = [];
    let currentId: Id<"files"> | undefined = args.id;

    while (currentId) {
      const file = (await ctx.db.get("files", currentId)) as
        | Doc<"files">
        | undefined;
      if (!file) break;

      path.unshift({ _id: file._id, name: file.name });
      currentId = file.parentId;
    }
    return path;
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
    const { project } = await verifyProjectOwnership(ctx, args.projectId);

    // Validate the file name
    const validName = validateName(args.name);

    //check if file with same name already exists in the same folder

    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const existing = siblings.find(
      (file) => file.name === validName && file.type === "file"
    );

    if (existing) {
      throw new Error("File with same name already exists in this folder");
    }

    const now = Date.now();
    await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: validName,
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
    await verifyProjectOwnership(ctx, args.projectId);

    // Validate the folder name
    const validName = validateName(args.name);

    //check if folder with same name already exists in the same folder

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId)
      )
      .collect();

    const existing = files.find(
      (file) => file.name === validName && file.type === "folder"
    );

    if (existing) {
      throw new Error("Folder with same name already exists in this folder");
    }

    const now = Date.now();
    await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: validName,
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
    // Validate the new name
    const validName = validateName(args.newName);

    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    const { project } = await verifyProjectOwnership(ctx, file.projectId);

    //check if a file with the new name already exists in the same parent folder
    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId)
      )
      .collect();

    const existing = siblings.find(
      (sibling) =>
        sibling.name === validName &&
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
      name: validName,
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
 * @throws {Error} "Folder too large" - If folder contains too many items for synchronous deletion
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
 * **Recursive Deletion:**
 * - When deleting a folder, all nested files and folders are deleted
 * - Uses breadth-first traversal with batched operations for efficiency
 * - Storage objects (storageId) are cleaned up in batches
 *
 * **Performance & Limits:**
 * - Small folders (< 100 items): Deleted synchronously with batched operations
 * - Large folders (≥ 100 items): Scheduled for background deletion to avoid timeout
 * - Convex mutations have time limits (~10 seconds); large trees are offloaded
 * - Batching reduces database operations and improves performance
 *
 * **Storage Cleanup:**
 * - Automatically deletes associated storage objects for binary files
 * - Text files (content field) don't have storage objects to clean
 * - Storage deletions are batched for efficiency
 *
 * ⚠️ **Warning:**
 * - This operation is permanent and cannot be undone
 * - Large folders may be deleted in the background (non-blocking)
 * - Ensure proper ownership validation before deletion
 */
export const deleteFile = mutation({
  args: {
    id: v.id("files"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    const { project } = await verifyProjectOwnership(ctx, file.projectId);

    /**
     * Recursively deletes a file or folder with optimized batched operations.
     *
     * **Performance Characteristics:**
     * - One-by-one recursive deletion can hit Convex mutation time limits (~10s)
     * - This applies when deleting folders with many nested items (>100 total files/folders)
     * - Time limit is cumulative across all database operations in a single mutation
     *
     * **Optimization Strategy:**
     * 1. Collect all items to delete in a single query (reduces DB round trips)
     * 2. Batch storage deletions together (more efficient than one-by-one)
     * 3. Batch database deletions together (reduces transaction overhead)
     * 4. For very large trees (≥100 items), schedule background deletion
     *
     * @param {Id<"files">} fileId - The ID of the file/folder to delete
     * @returns {Promise<boolean>} True if deletion completed, false if scheduled for background
     */
    const deleteRecursively = async (fileId: Id<"files">): Promise<boolean> => {
      const item = await ctx.db.get("files", fileId);

      if (!item) return true;

      // For single files, delete immediately
      if (item.type === "file") {
        if (item.storageId) {
          await ctx.storage.delete(item.storageId as Id<"_storage">);
        }
        await ctx.db.delete("files", fileId);
        return true;
      }

      // For folders, collect all descendants using breadth-first traversal
      const toProcess: Id<"files">[] = [fileId];
      const allItems: Array<{ _id: Id<"files">; storageId?: Id<"_storage"> }> =
        [];
      const BATCH_SIZE = 50; // Process in batches to avoid memory issues
      const MAX_SYNC_ITEMS = 100; // Threshold for background processing

      // Breadth-first collection of all items in the tree
      while (toProcess.length > 0) {
        const currentId = toProcess.shift()!;
        const currentItem = await ctx.db.get("files", currentId);

        if (!currentItem) continue;

        allItems.push({
          _id: currentItem._id,
          storageId: currentItem.storageId as Id<"_storage"> | undefined,
        });

        // If it's a folder, add its children to process queue
        if (currentItem.type === "folder") {
          const children = await ctx.db
            .query("files")
            .withIndex("by_project_parent", (q) =>
              q
                .eq("projectId", currentItem.projectId)
                .eq("parentId", currentItem._id)
            )
            .collect();

          toProcess.push(...children.map((c) => c._id));
        }

        // Check if tree is too large for synchronous deletion
        if (allItems.length >= MAX_SYNC_ITEMS) {
          // Schedule background deletion for large trees
          await ctx.scheduler.runAfter(
            0,
            internal.files.deleteFilesInBackground,
            {
              fileIds: allItems.map((item) => item._id),
              projectId: item.projectId,
            }
          );
          return false; // Indicate background processing
        }
      }

      // Batch delete storage objects
      const storageIds = allItems
        .map((item) => item.storageId)
        .filter((id): id is Id<"_storage"> => id !== undefined);

      // Delete storage in batches
      for (let i = 0; i < storageIds.length; i += BATCH_SIZE) {
        const batch = storageIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((id) => ctx.storage.delete(id)));
      }

      // Batch delete database records (in reverse order to delete children first)
      const fileIds = allItems.map((item) => item._id).reverse();
      for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
        const batch = fileIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((id) => ctx.db.delete("files", id)));
      }

      return true; // Deletion completed synchronously
    };

    const completedSync = await deleteRecursively(args.id);

    // Update project timestamp
    await ctx.db.patch("projects", project._id, {
      updatedAt: Date.now(),
    });

    // If deletion was scheduled for background, inform the user
    if (!completedSync) {
      // Note: In a real app, you might want to return a message or status
      // For now, the deletion will complete in the background
      console.log("Large folder deletion scheduled for background processing");
    }
  },
});

/**
 * Delete Files in Background (Internal Mutation)
 *
 * Internal mutation for handling large-scale file deletions that would exceed
 * mutation time limits if done synchronously. This is scheduled by deleteFile
 * when a folder tree contains ≥100 items.
 *
 * @internalMutation
 * @param {Object} args - Mutation arguments
 * @param {Id<"files">[]} args.fileIds - Array of file/folder IDs to delete
 * @param {Id<"projects">} args.projectId - The project ID (for updating timestamp)
 * @returns {Promise<void>}
 *
 * @remarks
 * - No authentication check needed (internal mutation, already validated)
 * - Processes deletions in batches to handle very large sets
 * - Deletes storage objects and database records efficiently
 * - Updates project timestamp after completion
 * - May be called multiple times for extremely large trees
 */
export const deleteFilesInBackground = internalMutation({
  args: {
    fileIds: v.array(v.id("files")),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 50;

    // Collect storage IDs from all files
    const storageIds: Id<"_storage">[] = [];

    for (const fileId of args.fileIds) {
      const file = await ctx.db.get("files", fileId);
      if (file?.storageId) {
        storageIds.push(file.storageId as Id<"_storage">);
      }
    }

    // Batch delete storage objects
    for (let i = 0; i < storageIds.length; i += BATCH_SIZE) {
      const batch = storageIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((id) => ctx.storage.delete(id)));
    }

    // Batch delete database records (reverse order to delete children first)
    const reversedIds = [...args.fileIds].reverse();
    for (let i = 0; i < reversedIds.length; i += BATCH_SIZE) {
      const batch = reversedIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((id) => ctx.db.delete("files", id)));
    }

    // Update project timestamp
    await ctx.db.patch("projects", args.projectId, {
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
    const file = await ctx.db.get("files", args.id);

    if (!file) {
      throw new Error("File not found");
    }

    const { project } = await verifyProjectOwnership(ctx, file.projectId);

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
