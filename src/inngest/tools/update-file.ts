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
 * Configuration options for the updateFiles tool.
 *
 * @interface UpdateFilesToolOptions
 * @property {string} internalKey - Convex internal authentication key for system-level operations.
 *                                  Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable.
 */
interface UpdateFilesToolOptions {
  internalKey: string;
}

/**
 * Zod schema for validating updateFiles tool parameters.
 *
 * Ensures that:
 * - At least one file ID is provided
 * - Each file ID is a non-empty string
 *
 * @constant
 */
const paramsSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  content: z.string(),
});

/**
 * Creates an AI agent tool for updating file contents in a project.
 *
 * This tool enables AI agents to update the contents of one or more files
 * stored in Convex. It's particularly useful for agents that need to modify
 * code, documentation, or other project files in a context-aware manner.
 *
 * @function createUpdateFilesTool
 *
 * @param {UpdateFilesToolOptions} options - Configuration options
 * @param {string} options.internalKey - Convex internal key for authenticated system access
 *
 * @returns {Tool} An Inngest agent tool configured for file updating operations
 *
 * @remarks
 * The tool performs the following operations:
 * 1. Validates input parameters using Zod schema
 * 2. Iterates through provided file IDs
 * 3. Retrieves file metadata and content from Convex
 * 4. Updates the content of each file in Convex
 * 5. Returns a JSON array of updated file objects with id, name, and content
 *
 * Error handling:
 * - Returns validation error message if parameters are invalid
 * - Returns helpful error if no valid files are found (suggests using listFiles tool)
 * - Catches and reports any runtime errors during file update
 *
 * Limitations:
 * - Only updates files with text content (content field populated)
 * - Does not handle binary files or files stored in Convex storage
 * - Silently skips files that don't exist or aren't accessible
 *
 * @example
 * // Create the tool with authentication
 * const tool = createUpdateFilesTool({ internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY });
 *
 * // Tool will be called by AI agent with parameters like:
 * // { fileIds: ["file1_id", "file2_id"], content: "New content for the files" }
 *
 * // Returns JSON:
 * // [
 * //   { id: "file1_id", name: "app.ts", content: "export const app = ..." },
 * //   { id: "file2_id", name: "utils.ts", content: "export function ..." }
 * // ]
 *
 * @see {@link createListFilesTool} for discovering available file IDs in a project
 */
export const createUpdateFilesTool = ({
  internalKey,
}: UpdateFilesToolOptions) => {
  return createTool({
    name: "updateFiles",
    description: "Update the content of an existing file.",
    parameters: z.object({
      fileId: z.string().describe("ID of the file to update"),
      content: z.string().describe("New content for the file"),
    }),
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Errors: ${parsed.error.issues[0].message}`;
      }

      const { fileId, content } = parsed.data;

      // validate file exists before attempting update
      const file = await convex.query(api.system.getFileById, {
        internalKey,
        fileId: fileId as Id<"files">,
      });

      if (!file) {
        return `Error: No file found for ID ${fileId}. Use listFiles to get valid file IDs.`;
      }

      if (file.type === "folder") {
        return `Error: "${file.name}" is a folder, not a file. You can only update files contents.`;
      }

      try {
        return await toolStep?.run("update-file", async () => {
          const results: { id: string; name: string; content: string }[] = [];

          // Update the file content in Convex
          await convex.mutation(api.system.updateFile, {
            internalKey,
            fileId: fileId as Id<"files">,
            content,
          });

          return `File "${file.name}" updated successfully.`;
        });
      } catch (error) {
        return `Error updating file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
