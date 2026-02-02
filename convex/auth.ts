/**
 * Authentication Utilities for Convex
 *
 * This module provides authentication helper functions for Convex queries and mutations.
 * These utilities integrate with Clerk authentication to verify user identity and
 * protect backend operations.
 *
 * @module convex/auth
 */

import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Verify User Authentication
 *
 * Validates that a user is authenticated before allowing access to protected Convex
 * operations. This function should be called at the beginning of any query or mutation
 * that requires user authentication.
 *
 * @async
 * @function verifyAuth
 *
 * @param {MutationCtx | QueryCtx} ctx - The Convex context object from a query or mutation.
 *   Contains the auth object used to retrieve user identity information.
 *
 * @returns {Promise<UserIdentity>} A promise that resolves to the authenticated user's
 *   identity object containing information like:
 *   - subject: Unique user identifier
 *   - email: User's email address
 *   - name: User's display name
 *   - tokenIdentifier: Token used for authentication
 *
 * @throws {Error} Throws an "Unauthorized" error if the user is not authenticated.
 *   This prevents unauthenticated access to protected operations.
 *
 * @example
 * // Usage in a Convex mutation
 * export const createProject = mutation({
 *   args: { name: v.string() },
 *   handler: async (ctx, args) => {
 *     // Verify the user is authenticated before proceeding
 *     const identity = await verifyAuth(ctx);
 *
 *     // Use the identity to associate data with the user
 *     return await ctx.db.insert("projects", {
 *       name: args.name,
 *       userId: identity.subject,
 *     });
 *   },
 * });
 *
 * @example
 * // Usage in a Convex query
 * export const getMyProjects = query({
 *   handler: async (ctx) => {
 *     // Ensure user is authenticated
 *     const identity = await verifyAuth(ctx);
 *
 *     // Query data for the authenticated user
 *     return await ctx.db
 *       .query("projects")
 *       .filter((q) => q.eq(q.field("userId"), identity.subject))
 *       .collect();
 *   },
 * });
 */
export const verifyAuth = async (ctx: MutationCtx | QueryCtx) => {
  // Attempt to retrieve the user's identity from the authentication context
  const identity = await ctx.auth.getUserIdentity();

  // If no identity is found, the user is not authenticated
  if (!identity) {
    throw new Error("Unauthorized");
  }

  // Return the verified identity for use in the calling function
  return identity;
};
