/**
 * Projects Hooks
 *
 * This module provides React hooks for interacting with project data in Convex.
 * These hooks handle data fetching, mutations, and optimistic updates for a smooth
 * user experience.
 *
 * @module features/projects/hooks/use-projects
 */

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";

/**
 * Use Projects Hook
 *
 * Fetches all projects for the authenticated user. Returns undefined while loading,
 * then returns an array of all user's projects sorted by most recently updated.
 *
 * @hook
 * @returns {Doc<"projects">[] | undefined} Array of all user's projects, or undefined while loading
 *
 * @example
 * const projects = useProjects();
 *
 * if (!projects) return <Spinner />;
 *
 * return (
 *   <ul>
 *     {projects.map(project => (
 *       <li key={project._id}>{project.name}</li>
 *     ))}
 *   </ul>
 * );
 */
export const useProjects = () => {
  return useQuery(api.projects.get);
};

/**
 * Use Projects Partial Hook
 *
 * Fetches a limited number of the user's most recent projects. Useful for displaying
 * a preview or "recent projects" section without loading all projects.
 *
 * @hook
 * @param {number} limit - Maximum number of projects to return
 * @returns {Doc<"projects">[] | undefined} Limited array of user's most recent projects,
 *   or undefined while loading
 *
 * @example
 * // Get the 5 most recently updated projects
 * const recentProjects = useProjectsPartial(5);
 *
 * if (!recentProjects) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h2>Recent Projects</h2>
 *     {recentProjects.map(project => (
 *       <ProjectCard key={project._id} project={project} />
 *     ))}
 *   </div>
 * );
 */
export const useProjectsPartial = (limit: number) => {
  return useQuery(api.projects.getPartial, { limit });
};

/**
 * Use Create Project Hook
 *
 * Returns a mutation function to create new projects with optimistic updates.
 * The optimistic update immediately adds the new project to the UI before the
 * server responds, providing instant feedback to the user.
 *
 * @hook
 * @returns {Function} Mutation function that accepts project creation arguments
 *   and returns a promise that resolves to the created project ID
 *
 * @example
 * const createProject = useCreateProject();
 *
 * const handleCreate = async () => {
 *   const projectId = await createProject({ name: "My New Project" });
 *   router.push(`/projects/${projectId}`);
 * };
 *
 * @remarks
 * Optimistic Update Behavior:
 * - Immediately adds the new project to the local store with a temporary ID
 * - Sets initial values for ownerId ("anonymous") and timestamps
 * - Prepends the new project to the existing projects list
 * - If the server mutation fails, Convex automatically rolls back the optimistic update
 * - Once server responds, replaces temporary data with actual server values
 */
export const useCreateProject = () => {
  const { userId } = useAuth();
  return useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      // Retrieve the current projects list from local store
      const existingProjects = localStore.getQuery(api.projects.get);

      if (existingProjects !== undefined) {
        const now = Date.now();

        // Create an optimistic project object with temporary values
        const newProject = {
          _id: crypto.randomUUID() as Id<"projects">, // Temporary ID until server responds
          _creationTime: now,
          name: args.name,
          ownerId: "anonymous" as string, // Temporary owner until server responds
          updatedAt: now,
        };

        // Optimistically update the local store by prepending the new project
        localStore.setQuery(api.projects.get, {}, [
          newProject,
          ...existingProjects,
        ]);
      }
    }
  );
};
