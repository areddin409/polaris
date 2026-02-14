/**
 * @fileoverview Inngest Agent Tool for reading file contents from projects.
 *
 * This module provides an AI agent tool that allows reading multiple file contents
 * from a project stored in Convex. The tool is designed to be used within Inngest
 * agent workflows for operations like code review, analysis, or contextual responses.
 *
 * Key features:
 * - Batch reading of multiple files in a single operation
 * - Validation of file IDs with Zod schema
 * - Graceful error handling for missing or inaccessible files
 * - Integration with Convex system API for secure file access
 * - Returns structured JSON with file metadata and contents
 *
 * @module read-files-tool
 */

import { z } from "zod";
import { createTool } from "@inngest/agent-kit";

import { convex } from "@/lib/convex-client";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Configuration options for the createFolder tool.
 *
 * @interface CreateFolderToolOptions
 * @property {Id<"projects">} projectId - The ID of the project to create folders in. Scopes the tool to a specific project context.
 * @property {string} internalKey - Convex internal authentication key for system-level operations.
 *                                  Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable.
 */
interface CreateFolderToolOptions {
  projectId: Id<"projects">;
  internalKey: string;
}

const paramsSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentId: z
    .string()
    .describe("The ID of the parent folder. Use empty string for root level."),
});
/**
 * Creates an AI agent tool for creating new folders in a project.
 *
 * This tool enables AI agents to create one or more new folders
 * stored in Convex. It's particularly useful for agents that need to add
 * code, documentation, or other project files in a context-aware manner.
 *
 * @function createFolderTool
 *
 * @param {CreateFolderToolOptions} options - Configuration options
 * @param {string} options.internalKey - Convex internal key for authenticated system access
 *
 * @returns {Tool} An Inngest agent tool configured for folder creation operations
 *
 
 *
 * @example
 * // Create the tool with authentication
 * const tool = createFolderTool({ internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY });
 *
 * // Tool will be called by AI agent with parameters like:
 * // { folderIds: ["folder1_id", "folder2_id"], name: "New Folder" }
 *
 * // Returns JSON:
 * // [
 * //   { id: "folder1_id", name: "New Folder 1" },
 * //   { id: "folder2_id", name: "New Folder 2" }
 * // ]
 *
 * @see {@link createListFilesTool} for discovering available folder IDs in a project
 */
export const createFolderTool = ({
  projectId,
  internalKey,
}: CreateFolderToolOptions) => {
  return createTool({
    name: "createFolder",
    description: "Create a new folder in the project.",
    parameters: z.object({
      name: z.string().describe("The name of the folder to create."),
      parentId: z
        .string()
        .describe(
          "The ID(not name!) of the parent folder from listFiles, or empty string for root level."
        ),
    }),
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Errors: ${parsed.error.issues[0].message}`;
      }

      const { parentId, name } = parsed.data;

      try {
        return await toolStep?.run("create-folder", async () => {
          if (parentId) {
            try {
              const parentFolder = await convex.query(api.system.getFileById, {
                internalKey,
                fileId: parentId as Id<"files">,
              });

              if (!parentFolder) {
                return `Error: No folder found for parentId ${parentId}. Use listFiles to get valid folder IDs.`;
              }

              if (parentFolder.type !== "folder") {
                return `Error: parentId ${parentId} is a file, not a folder. Use a folder ID as parentId.`;
              }
            } catch {
              return `Error: Invalid parentId ${parentId}. Use listFiles to get valid folder IDs, or use empty string for root level.`;
            }
          }

          const folderId = await convex.mutation(api.system.createFolder, {
            internalKey,
            projectId,
            parentId: parentId ? (parentId as Id<"files">) : undefined,
            name,
          });

          return `Folder create with ID: ${folderId} and name: "${name}"`;
        });
      } catch (error) {
        return `Error creating folders: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
