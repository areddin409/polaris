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
 * Configuration options for the deleteFiles tool.
 *
 * @interface DeleteFilesToolOptions
 * @property {Id<"projects">} projectId - The ID of the project to delete files from. Scopes the tool to a specific project context.
 * @property {string} internalKey - Convex internal authentication key for system-level operations.
 *                                  Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable.
 */
interface DeleteFilesToolOptions {
  internalKey: string;
}

const paramsSchema = z.object({
  fileIds: z
    .array(z.string().min(1, "File ID cannot be empty"))
    .min(1, "At least one file ID is required"),
});

/**
 * Creates an AI agent tool for deleting files in a project.
 *
 * This tool enables AI agents to delete one or more files
 * stored in Convex. It's particularly useful for agents that need to remove
 * code, documentation, or other project files in a context-aware manner.
 *
 * @function deleteFilesTool
 *
 * @param {DeleteFilesToolOptions} options - Configuration options
 * @param {string} options.internalKey - Convex internal key for authenticated system access
 *
 * @returns {Tool} An Inngest agent tool configured for file deletion operations
 *
 */
export const createDeleteFilesTool = ({
  internalKey,
}: DeleteFilesToolOptions) => {
  return createTool({
    name: "deleteFiles",
    description:
      "Delete files or folders from the project. If deleting a folder, all contents will be deleted recursively.",
    parameters: z.object({
      fileIds: z.array(
        z.string().describe("Array of file or folder IDs to delete")
      ),
    }),
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Errors: ${parsed.error.issues[0].message}`;
      }

      const { fileIds } = parsed.data;

      // validate files exist before attempting delete
      const filesToDelete: {
        id: string;
        name: string;
        type: string;
      }[] = [];

      for (const fileId of fileIds) {
        const file = await convex.query(api.system.getFileById, {
          internalKey,
          fileId: fileId as Id<"files">,
        });

        if (!file) {
          return `Error: No file found for ID ${fileId}. Use listFiles to get valid file IDs.`;
        }
        filesToDelete.push({
          id: fileId,
          name: file.name,
          type: file.type,
        });
      }

      try {
        return await toolStep?.run("delete-files", async () => {
          const results: string[] = [];

          for (const file of filesToDelete) {
            await convex.mutation(api.system.deleteFile, {
              internalKey,
              fileId: file.id as Id<"files">,
            });
            results.push(
              `Deleted ${file.type} "${file.name}" (ID: ${file.id}) successfully.`
            );
          }
          return results.join("\n");
        });
      } catch (error) {
        return `Error creating files: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
