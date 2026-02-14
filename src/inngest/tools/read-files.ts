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
 * Configuration options for the readFiles tool.
 *
 * @interface ReadFilesToolOptions
 * @property {string} internalKey - Convex internal authentication key for system-level operations.
 *                                  Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable.
 */
interface ReadFilesToolOptions {
  internalKey: string;
}

/**
 * Zod schema for validating readFiles tool parameters.
 *
 * Ensures that:
 * - At least one file ID is provided
 * - Each file ID is a non-empty string
 *
 * @constant
 */
const paramsSchema = z.object({
  fileIds: z
    .array(z.string().min(1, "File ID cannot be empty"))
    .min(1, "At least one file ID is required"),
});

/**
 * Creates an AI agent tool for reading file contents from a project.
 *
 * This tool enables AI agents to retrieve the contents of one or more files
 * stored in Convex. It's particularly useful for agents that need to analyze
 * code, reference documentation, or provide context-aware responses based on
 * project files.
 *
 * @function createReadFilesTool
 *
 * @param {ReadFilesToolOptions} options - Configuration options
 * @param {string} options.internalKey - Convex internal key for authenticated system access
 *
 * @returns {Tool} An Inngest agent tool configured for file reading operations
 *
 * @remarks
 * The tool performs the following operations:
 * 1. Validates input parameters using Zod schema
 * 2. Iterates through provided file IDs
 * 3. Retrieves file metadata and content from Convex
 * 4. Filters out missing files or files without content (e.g., directories, binary files)
 * 5. Returns a JSON array of file objects with id, name, and content
 *
 * Error handling:
 * - Returns validation error message if parameters are invalid
 * - Returns helpful error if no valid files are found (suggests using listFiles tool)
 * - Catches and reports any runtime errors during file retrieval
 *
 * Limitations:
 * - Only returns files with text content (content field populated)
 * - Does not handle binary files or files stored in Convex storage
 * - Silently skips files that don't exist or aren't accessible
 *
 * @example
 * // Create the tool with authentication
 * const tool = createReadFilesTool({ internalKey: process.env.POLARIS_CONVEX_INTERNAL_KEY });
 *
 * // Tool will be called by AI agent with parameters like:
 * // { fileIds: ["file1_id", "file2_id"] }
 *
 * // Returns JSON:
 * // [
 * //   { id: "file1_id", name: "app.ts", content: "export const app = ..." },
 * //   { id: "file2_id", name: "utils.ts", content: "export function ..." }
 * // ]
 *
 * @see {@link createListFilesTool} for discovering available file IDs in a project
 */
export const createReadFilesTool = ({ internalKey }: ReadFilesToolOptions) => {
  return createTool({
    name: "readFiles",
    description:
      "Read the content of files from the project. Returns file contents.",
    parameters: z.object({
      fileIds: z.array(z.string()).describe("Array of file IDs to read"),
    }),
    handler: async (params, { step: toolStep }) => {
      // Validate input parameters with detailed error messages
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Errors: ${parsed.error.issues[0].message}`;
      }

      const { fileIds } = parsed.data;

      try {
        return await toolStep?.run("read-files", async () => {
          const results: { id: string; name: string; content: string }[] = [];

          // Retrieve each file from Convex
          for (const fileId of fileIds) {
            const file = await convex.query(api.system.getFileById, {
              internalKey,
              fileId: fileId as Id<"files">,
            });

            // Only include files with text content
            // Excludes: directories, binary files, and non-existent files
            if (file && file.content) {
              results.push({
                id: file._id,
                name: file.name,
                content: file.content,
              });
            }
          }

          // Provide helpful error message if no valid files found
          if (results.length === 0) {
            return "Error: No files found for the provided IDs. Use listFiles to get valid fileIDs.";
          }

          return JSON.stringify(results);
        });
      } catch (error) {
        return `Error reading files: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
