/**
 * Project Icon Utility
 *
 * Provides visual status indicators for projects based on their import/export status.
 * Returns appropriate icons to represent different project states.
 *
 * @module features/projects/utils/get-project-icon
 */

import { AlertCircleIcon, GlobeIcon, Loader2Icon } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { Doc } from "../../../../convex/_generated/dataModel";

/**
 * Icon size variants
 * @typedef {"sm" | "default"} Size
 */
type Size = "sm" | "default";

/**
 * Props for getProjectIcon function
 *
 * @interface GetProjectIconProps
 * @property {Doc<"projects">} project - The project document containing status information
 * @property {Size} [size="default"] - Icon size variant (sm: 14px, default: 16px)
 */
interface GetProjectIconProps {
  project: Doc<"projects">;
  size?: Size;
}

/**
 * Get Project Icon
 *
 * Returns a React icon component that visually represents the project's current status.
 * The icon changes based on the project's import status to provide visual feedback.
 *
 * @function getProjectIcon
 * @param {GetProjectIconProps} props - Configuration object
 * @param {Doc<"projects">} props.project - Project document with status information
 * @param {Size} [props.size="default"] - Size variant for the icon
 * @returns {JSX.Element} Icon component styled appropriately for the project state
 *
 * @example
 * // Display a small icon for a GitHub-imported project
 * {getProjectIcon({ project, size: "sm" })}
 *
 * @example
 * // Display default-sized icon (automatically chooses based on status)
 * {getProjectIcon({ project })}
 *
 * @remarks
 * Icon States:
 * - **GitHub Icon** (completed): Project successfully imported from GitHub
 * - **Alert Icon** (failed): Import/export operation failed
 * - **Loader Icon** (importing): Import operation in progress (animated)
 * - **Globe Icon** (default): New project or no import status
 */
export const getProjectIcon = ({
  project,
  size = "default",
}: GetProjectIconProps) => {
  const sizeClass = size === "sm" ? "size-3.5" : "size-4";

  if (project.importStatus === "completed") {
    return <FaGithub className={`text-muted-foreground ${sizeClass}`} />;
  }

  if (project.importStatus === "failed") {
    return <AlertCircleIcon className={`${sizeClass} text-red-400`} />;
  }

  if (project.importStatus === "importing") {
    return (
      <Loader2Icon
        className={`text-muted-foreground ${sizeClass} animate-spin`}
      />
    );
  }

  return <GlobeIcon className={`text-muted-foreground ${sizeClass}`} />;
};
