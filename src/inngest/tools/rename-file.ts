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
 * Configuration options for the renameFiles tool.
 *
 * @interface RenameFilesToolOptions
 * @property {string} internalKey - Convex internal authentication key for system-level operations.
 *                                  Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable.
 */
interface RenameFilesToolOptions {
  internalKey: string;
}

const paramsSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  newName: z.string().min(1, "New name is required"),
});

/**
 * Creates an AI agent tool for renaming files in a project.
 *
 * This tool enables AI agents to update the contents of one or more files
 * stored in Convex. It's particularly useful for agents that need to modify
 * code, documentation, or other project files in a context-aware manner.
 *
 * @function RenameFilesTool
 *
 * @param {RenameFilesToolOptions} options - Configuration options
 * @param {string} options.internalKey - Convex internal key for authenticated system access
 *
 * @returns {Tool} An Inngest agent tool configured for file renaming operations
 *
 */
export const createRenameFileTool = ({
  internalKey,
}: RenameFilesToolOptions) => {
  return createTool({
    name: "renameFiles",
    description: "Rename an existing file.",
    parameters: z.object({
      fileId: z.string().describe("ID of the file to rename"),
      newName: z.string().describe("New name for the file"),
    }),
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Errors: ${parsed.error.issues[0].message}`;
      }

      const { fileId, newName } = parsed.data;

      // validate file exists before attempting update
      const file = await convex.query(api.system.getFileById, {
        internalKey,
        fileId: fileId as Id<"files">,
      });

      if (!file) {
        return `Error: No file found for ID ${fileId}. Use listFiles to get valid file IDs.`;
      }

      try {
        return await toolStep?.run("rename-file", async () => {
          await convex.mutation(api.system.renameFile, {
            internalKey,
            fileId: fileId as Id<"files">,
            newName,
          });

          return `Renamed file "${file.name}" to "${newName}" successfully.`;
        });
      } catch (error) {
        return `Error renaming file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
