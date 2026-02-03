/**
 * Convex Utility Functions
 *
 * Shared helper functions used across multiple Convex modules.
 * Includes authentication, validation, and common business logic.
 *
 * @module convex/utils
 */

import { QueryCtx, MutationCtx } from "./_generated/server";
import { verifyAuth } from "./auth";
import { Id, Doc } from "./_generated/dataModel";

/**
 * Verifies project ownership
 *
 * Common helper to authenticate the user and verify they own the specified project.
 * Used across project and file operations to ensure consistent authorization.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context
 * @param {Id<"projects">} projectId - The ID of the project to verify ownership for
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project doesn't exist
 * @throws {Error} "Unauthorized" - If user doesn't own the project
 * @returns {Promise<{identity: any, project: Doc<"projects">}>} The authenticated identity and project
 *
 * @example
 * const { identity, project } = await verifyProjectOwnership(ctx, args.projectId);
 */
export async function verifyProjectOwnership(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
): Promise<{ identity: any; project: Doc<"projects"> }> {
  const identity = await verifyAuth(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId !== identity.subject) {
    throw new Error("Unauthorized");
  }

  return { identity, project };
}

/**
 * Validates a file or folder name
 *
 * Ensures the name meets all requirements for safe filesystem operations:
 * - Not empty or whitespace-only
 * - Maximum length of 255 characters
 * - No path separators (/, \)
 * - No special characters that could cause issues (< > : " | ? *)
 * - No control characters (\x00-\x1f)
 *
 * @param {string} name - The name to validate
 * @throws {Error} Descriptive error message if validation fails
 * @returns {string} The trimmed, validated name
 *
 * @example
 * const validName = validateName("  my-file.txt  "); // Returns "my-file.txt"
 * validateName(""); // Throws: Name cannot be empty
 * validateName("my/file.txt"); // Throws: Name cannot contain path separators
 */
export function validateName(name: string): string {
  // Trim whitespace
  const trimmed = name.trim();

  // Check for empty or whitespace-only
  if (!trimmed || trimmed.length === 0) {
    throw new Error("Name cannot be empty or contain only whitespace");
  }

  // Check max length
  if (trimmed.length > 255) {
    throw new Error("Name cannot exceed 255 characters");
  }

  // Check for path separators
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("Name cannot contain path separators (/ or \\)");
  }

  // Check for invalid characters: < > : " | ? *
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(trimmed)) {
    throw new Error('Name cannot contain special characters: < > : " | ? *');
  }

  // Check for control characters (\x00-\x1f)
  const controlChars = /[\x00-\x1f]/;
  if (controlChars.test(trimmed)) {
    throw new Error("Name cannot contain control characters");
  }

  return trimmed;
}
