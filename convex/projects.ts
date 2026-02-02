/**
 * Projects Convex Functions
 *
 * This module defines all Convex queries and mutations for managing projects.
 * All operations require authentication and are scoped to the authenticated user.
 * Projects are automatically sorted by most recently updated.
 *
 * @module convex/projects
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";

/**
 * Create Project Mutation
 *
 * Creates a new project for the authenticated user. The project is automatically
 * assigned to the user based on their authentication identity.
 *
 * @mutation
 * @param {Object} args - Mutation arguments
 * @param {string} args.name - Name of the project to create
 * @returns {Promise<Id<"projects">>} The ID of the newly created project
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 *
 * @example
 * // From React component using Convex hooks
 * const createProject = useMutation(api.projects.create);
 *
 * const handleCreate = async () => {
 *   const projectId = await createProject({ name: "My New Project" });
 *   console.log("Created project:", projectId);
 * };
 *
 * @remarks
 * - Requires authentication via verifyAuth
 * - Automatically sets ownerId from authenticated user
 * - Sets updatedAt to current timestamp
 * - Project names can be any non-empty string
 */
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated and get their identity
    const identity = await verifyAuth(ctx);

    // Insert new project with authenticated user as owner
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      ownerId: identity.subject, // Associate project with user
      updatedAt: Date.now(), // Track when project was last modified
    });

    return projectId;
  },
});

/**
 * Get Partial Projects Query
 *
 * Fetches a limited number of the authenticated user's projects, ordered by
 * most recently updated. Useful for displaying recent projects or previews
 * without loading the entire list.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {number} args.limit - Maximum number of projects to return
 * @returns {Promise<Doc<"projects">[]>} Array of user's most recent projects
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 *
 * @example
 * // From React component using Convex hooks
 * const recentProjects = useQuery(api.projects.getPartial, { limit: 5 });
 *
 * if (!recentProjects) return <Spinner />;
 *
 * return (
 *   <ul>
 *     {recentProjects.map(project => (
 *       <li key={project._id}>{project.name}</li>
 *     ))}
 *   </ul>
 * );
 *
 * @remarks
 * - Returns projects in descending order (newest first)
 * - Only returns projects owned by the authenticated user
 * - Uses indexed query for optimal performance
 * - Returns empty array if user has no projects
 */
export const getPartial = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    // Query projects using owner index for performance
    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc") // Most recently updated first
      .take(args.limit); // Limit number of results
  },
});
/**
 * Get All Projects Query
 *
 * Fetches all projects owned by the authenticated user, ordered by most
 * recently updated. Use this for displaying complete project lists or
 * command palettes.
 *
 * @query
 * @returns {Promise<Doc<"projects">[]>} Array of all user's projects
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 *
 * @example
 * // From React component using Convex hooks
 * const allProjects = useQuery(api.projects.get);
 *
 * if (!allProjects) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h2>All Projects ({allProjects.length})</h2>
 *     {allProjects.map(project => (
 *       <ProjectCard key={project._id} project={project} />
 *     ))}
 *   </div>
 * );
 *
 * @remarks
 * - Returns projects in descending order (newest first)
 * - Only returns projects owned by the authenticated user
 * - Uses indexed query for optimal performance
 * - Returns empty array if user has no projects
 * - For large project lists, consider using getPartial instead
 */
export const get = query({
  handler: async (ctx) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    // Query all projects for the authenticated user
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc") // Most recently updated first
      .collect(); // Collect all results
    return projects;
  },
});

/**
 * Get Project By ID Query
 *
 * Fetches a single project by its ID. Verifies that the authenticated user
 * owns the project before returning it, ensuring data security.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"projects">} args.id - The ID of the project to fetch
 * @returns {Promise<Doc<"projects">>} The requested project document
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project with given ID doesn't exist
 * @throws {Error} "Unauthorized" - If project belongs to a different user
 *
 * @example
 * // From React component using Convex hooks
 * const project = useQuery(api.projects.getById, { id: projectId });
 *
 * if (!project) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h1>{project.name}</h1>
 *     <p>Owner: {project.ownerId}</p>
 *     <p>Updated: {new Date(project.updatedAt).toLocaleDateString()}</p>
 *   </div>
 * );
 *
 * @remarks
 * - Verifies user authentication before accessing data
 * - Enforces ownership validation for security
 * - Useful for project detail pages
 * - Returns null while loading (handled by Convex hooks)
 * - Throws error if project doesn't exist or user doesn't own it
 */
export const getById = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    // Fetch project by ID
    const project = await ctx.db.get("projects", args.id);

    // Ensure project exists
    if (!project) throw new Error("Project not found");

    // Verify the authenticated user owns this project
    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return project;
  },
});

/** Rename Project Mutation
 *
 * Renames an existing project owned by the authenticated user.     

  * @mutation
  * @param {Object} args - Mutation arguments
  * @param {Id<"projects">} args.id - The ID of the project to rename
  * @param {string} args.name - The new name for the project
  * @returns {Promise<void>} Resolves when the project is successfully renamed
  *
  * @throws {Error} "Unauthorized" - If user is not authenticated
  * @throws {Error} "Project not found" - If project with given ID doesn't exist
  * @throws {Error} "Unauthorized" - If project belongs to a different user
  *
 */
export const renameProject = mutation({
  args: {
    id: v.id("projects"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.id);

    // Ensure project exists
    if (!project) throw new Error("Project not found");

    // Verify the authenticated user owns this project
    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Update project name and updatedAt timestamp
    await ctx.db.patch("projects", args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});
