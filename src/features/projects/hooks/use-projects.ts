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
import { Id } from "../../../../convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";

/**
 * Use Project Hook
 *
 * Fetches a single project by its ID. Verifies ownership and returns the project
 * data if it belongs to the authenticated user. Returns undefined while loading.
 *
 * @hook
 * @param {Id<"projects">} projectId - The unique identifier of the project to fetch
 * @returns {Doc<"projects"> | undefined} The project document, or undefined while loading
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated or doesn't own the project
 * @throws {Error} "Project not found" - If the project doesn't exist
 *
 * @example
 * // In a project detail page
 * function ProjectPage({ projectId }: { projectId: Id<"projects"> }) {
 *   const project = useProject(projectId);
 *
 *   if (!project) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h1>{project.name}</h1>
 *       <p>Last updated: {new Date(project.updatedAt).toLocaleDateString()}</p>
 *     </div>
 *   );
 * }
 *
 * @remarks
 * - Requires authentication and ownership verification
 * - Returns undefined while loading (handle this in your UI)
 * - Throws error if project doesn't exist or user doesn't own it
 * - Useful for project detail pages and editing interfaces
 */
export const useProject = (projectId: Id<"projects">) => {
  return useQuery(api.projects.getById, { id: projectId });
};

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

/**
 * Use Rename Project Hook
 *
 * Returns a mutation function to rename an existing project with optimistic updates.
 * The optimistic update immediately updates the project name in the UI before the
 * server responds, providing instant feedback to the user.
 *
 * @hook
 * @param {Id<"projects">} projectId - The unique identifier of the project to rename
 * @returns {Function} Mutation function that accepts the new name and returns a promise
 *
 * @example
 * const renameProject = useRenameProject(projectId);
 *
 * const handleRename = async (newName: string) => {
 *   await renameProject({ id: projectId, name: newName });
 *   toast.success("Project renamed successfully!");
 * };
 *
 * @example
 * // In an inline edit component
 * function ProjectNameEditor({ projectId, currentName }: Props) {
 *   const [name, setName] = useState(currentName);
 *   const renameProject = useRenameProject(projectId);
 *
 *   const handleSave = async () => {
 *     if (name !== currentName) {
 *       await renameProject({ id: projectId, name });
 *     }
 *   };
 *
 *   return (
 *     <input value={name} onChange={e => setName(e.target.value)} onBlur={handleSave} />
 *   );
 * }
 *
 * @remarks
 * Optimistic Update Behavior:
 * - Immediately updates the project name in both single and list queries
 * - Updates the project's `updatedAt` timestamp optimistically
 * - Affects both `api.projects.getById` and `api.projects.get` queries
 * - If the server mutation fails, Convex automatically rolls back all optimistic updates
 * - Once server responds, replaces optimistic data with actual server values
 *
 * Performance Notes:
 * - Updates multiple cache entries to keep UI consistent
 * - Prevents UI flicker during rename operations
 * - Works seamlessly with React's concurrent rendering
 */
export const useRenameProject = () => {
  return useMutation(api.projects.renameProject).withOptimisticUpdate(
    (localStore, args) => {
      // Update the single project query optimistically
      const existingProject = localStore.getQuery(api.projects.getById, {
        id: args.id,
      });

      if (existingProject !== undefined && existingProject !== null) {
        localStore.setQuery(
          api.projects.getById,
          { id: args.id },
          {
            ...existingProject,
            name: args.name,
            updatedAt: Date.now(), // Update timestamp optimistically
          }
        );
      }

      // Update the projects list query optimistically
      const existingProjects = localStore.getQuery(api.projects.get);
      if (existingProjects !== undefined) {
        localStore.setQuery(
          api.projects.get,
          {},
          existingProjects.map((project) =>
            project._id === args.id
              ? { ...project, name: args.name, updatedAt: Date.now() }
              : project
          )
        );
      }
    }
  );
};
