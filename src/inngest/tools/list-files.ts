/**
 * @fileoverview Inngest Agent Tool for listing files and folders in projects.
 *
 * This module provides an AI agent tool that discovers and organizes all files and
 * folders within a project stored in Convex. The tool is designed to be used within
 * Inngest agent workflows to help AI agents understand project structure before
 * performing operations like code review, file reading, or context gathering.
 *
 * Key features:
 * - Lists all files and folders in a project hierarchy
 * - Returns structured metadata (id, name, type, parentId)
 * - Sorted output (folders first, then files, alphabetically)
 * - Hierarchical organization via parentId references
 * - Integration with Convex system API for secure access
 * - Zero parameters required (uses project context from tool creation)
 *
 * @module list-files-tool
 */

import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Configuration options for the listFiles tool.
 */
interface ListFilesToolOptions {
  /** The project ID to list files from. Scopes the tool to a specific project context. */
  projectId: Id<"projects">;
  /** Convex internal authentication key for system-level operations. Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable. */
  internalKey: string;
}

/**
 * Creates an AI agent tool for listing files and folders in a project.
 *
 * This tool enables AI agents to discover all files and folders within a project,
 * providing the structure and metadata needed to understand the project organization.
 * It's particularly useful as a first step before reading specific files, allowing
 * agents to navigate the project hierarchy intelligently.
 *
 * @param options - Configuration options including projectId and internalKey
 * @returns An Inngest agent tool configured for file listing operations
 *
 * @remarks
 * The tool performs the following operations:
 * 1. Retrieves all files and folders for the specified project from Convex
 * 2. Sorts the results (folders before files, then alphabetically by name)
 * 3. Maps each item to a structured object with metadata
 * 4. Returns a JSON string with the complete file tree
 *
 * **Output Structure:**
 * Each item in the returned array contains:
 * - `id`: Unique file/folder identifier (use with readFiles tool)
 * - `name`: File or folder name
 * - `type`: Either "file" or "folder"
 * - `parentId`: ID of parent folder, or null if at root level
 *
 * **Understanding Hierarchy:**
 * - Items with `parentId: null` are at the project root
 * - Items with the same `parentId` are siblings in the same folder
 * - To find folder contents, look for items where `parentId === folderId`
 *
 * **Sorting Behavior:**
 * - Folders appear before files at each level
 * - Within each type, items are sorted alphabetically by name
 * - This provides a consistent, predictable structure for agents
 *
 * Error handling:
 * - Catches and reports any runtime errors during file retrieval
 * - Returns user-friendly error messages for debugging
 *
 * @example
 * // Create the tool with project context
 * const tool = createListFilesTool({
 *   projectId: "proj_123",
 *   internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY
 * });
 *
 * // Tool will be called by AI agent with no parameters:
 * // listFiles()
 *
 * // Returns JSON:
 * // [
 * //   { id: "folder_1", name: "src", type: "folder", parentId: null },
 * //   { id: "folder_2", name: "components", type: "folder", parentId: "folder_1" },
 * //   { id: "file_1", name: "app.ts", type: "file", parentId: "folder_1" },
 * //   { id: "file_2", name: "Button.tsx", type: "file", parentId: "folder_2" },
 * //   { id: "file_3", name: "README.md", type: "file", parentId: null }
 * // ]
 *
 * @see {@link createReadFilesTool} for reading the actual contents of discovered files
 */
export const createListFilesTool = ({
  projectId,
  internalKey,
}: ListFilesToolOptions) => {
  return createTool({
    name: "listFiles",
    description:
      "List all files and folders in the project. Returns names, IDs, and types, and parentId for each item. Items with parentId: null are at root level. Use the parentId to understand the folder structure - items with the same parentId are in the same folder.",
    parameters: z.object({}), // No parameters needed - uses projectId from tool creation
    handler: async (_, { step: toolStep }) => {
      try {
        return await toolStep?.run("list-files", async () => {
          // Retrieve all files and folders for this project
          const files = await convex.query(api.system.getProjectFiles, {
            internalKey,
            projectId,
          });

          // Sort folders first, then files, both alphabetically
          // This provides a consistent, readable structure for AI agents
          const sorted = files.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === "folder" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          // Map to simplified structure with essential metadata
          const fileList = sorted.map((file) => ({
            id: file._id,
            name: file.name,
            type: file.type,
            parentId: file.parentId ?? null, // null indicates root level
          }));

          return JSON.stringify(fileList);
        });
      } catch (error) {
        return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
