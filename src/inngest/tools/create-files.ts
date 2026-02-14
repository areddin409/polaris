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
 * Configuration options for the createFiles tool.
 *
 * @interface CreateFilesToolOptions
 * @property {Id<"projects">} projectId - The ID of the project to create files in. Scopes the tool to a specific project context.
 * @property {string} internalKey - Convex internal authentication key for system-level operations.
 *                                  Retrieved from POLARIS_CONVEX_INTERNAL_KEY environment variable.
 */
interface CreateFilesToolOptions {
  projectId: Id<"projects">;
  internalKey: string;
}

/**
 * Zod schema for validating createFiles tool parameters.
 *
 * Ensures that:
 * - At least one file ID is provided
 * - Each file ID is a non-empty string
 *
 * @constant
 */
const paramsSchema = z.object({
  parentId: z.string(),
  files: z
    .array(
      z.object({
        name: z.string().min(1, "File name is required"),
        content: z.string(),
      })
    )
    .min(1, "At least one file is required"),
});

/**
 * Creates an AI agent tool for creating new files in a project.
 *
 * This tool enables AI agents to create one or more new files
 * stored in Convex. It's particularly useful for agents that need to add
 * code, documentation, or other project files in a context-aware manner.
 *
 * @function createFilesTool
 *
 * @param {CreateFilesToolOptions} options - Configuration options
 * @param {string} options.internalKey - Convex internal key for authenticated system access
 *
 * @returns {Tool} An Inngest agent tool configured for file creation operations
 *
 
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
export const createFilesTool = ({
  projectId,
  internalKey,
}: CreateFilesToolOptions) => {
  return createTool({
    name: "createFiles",
    description:
      "Create multiple files at once in the same folder. use this to batch create files that share the same parent folder. More Efficient than creating files one by one.",
    parameters: z.object({
      parentId: z
        .string()
        .describe(
          "The ID of the parent folder. Use empty string for root level. Must be a valid folder ID from listFiles."
        ),
      files: z
        .array(
          z.object({
            name: z.string().describe("The file name including extension"),
            content: z.string().describe("The text content of the file"),
          })
        )
        .describe(
          "An array of files to create. Each file must have a name and content."
        ),
    }),
    handler: async (params, { step: toolStep }) => {
      const parsed = paramsSchema.safeParse(params);
      if (!parsed.success) {
        return `Errors: ${parsed.error.issues[0].message}`;
      }

      const { parentId, files } = parsed.data;

      try {
        return await toolStep?.run("create-files", async () => {
          let resolvedParentId: Id<"files"> | undefined;

          if (parentId && parentId !== "") {
            try {
              resolvedParentId = parentId as Id<"files">;
              const parentFolder = await convex.query(api.system.getFileById, {
                internalKey,
                fileId: resolvedParentId,
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

          const results = await convex.mutation(api.system.createFiles, {
            internalKey,
            projectId,
            parentId: resolvedParentId,
            files,
          });

          const created = results.filter((r) => !r.error);
          const failed = results.filter((r) => r.error);

          let response = `Created ${created.length} file(s)`;
          if (created.length > 0) {
            response += `: ${created.map((r) => r.name).join(", ")}`;
          }
          if (failed.length > 0) {
            response += `. Failed: ${failed.map((r) => `${r.name} (${r.error})`).join(", ")}`;
          }
          return response;
        });
      } catch (error) {
        return `Error creating files: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
};
