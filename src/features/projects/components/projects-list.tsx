/**
 * Projects List Component
 *
 * Displays a curated list of recent projects with a featured "Continue" card
 * for the most recently updated project. Provides quick access to project history
 * and navigation.
 *
 * @module features/projects/components/projects-list
 */

import Link from "next/link";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Doc } from "../../../../convex/_generated/dataModel";
import { useProjectsPartial } from "../hooks/use-projects";
import { Button } from "@/components/ui/button";
import { getProjectIcon } from "../utils/get-project-icon";

/**
 * Props for ProjectsList component
 *
 * @interface ProjectsListProps
 * @property {() => void} onViewAll - Callback when "View All" button is clicked
 */
interface ProjectsListProps {
  onViewAll: () => void;
}

/**
 * Continue Card Component
 *
 * Displays a prominent card for the most recently updated project,
 * encouraging the user to continue their work.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Doc<"projects">} props.data - The most recent project data
 * @returns {JSX.Element} Featured project card with timestamp
 *
 * @remarks
 * Design Features:
 * - Larger card format for visual prominence
 * - Status icon indicating project type/state
 * - Arrow indicator with hover animation
 * - Relative timestamp (e.g., "2 hours ago")
 * - Full clickable area for navigation
 */
const ContinueCard = ({ data }: { data: Doc<"projects"> }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">Last updated</span>
      <Button
        variant={"outline"}
        asChild
        className="bg-background flex h-auto flex-col items-start justify-start gap-2 rounded-none border p-4"
      >
        <Link href={`/projects/${data._id}`} className="group">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {getProjectIcon({ project: data, size: "sm" })}
              <span className="truncate font-medium">{data.name}</span>
            </div>
            <ArrowRightIcon className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(data.updatedAt)}
          </span>
        </Link>
      </Button>
    </div>
  );
};

/**
 * Format Timestamp
 *
 * Converts a Unix timestamp to a human-readable relative time string.
 *
 * @function formatTimestamp
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string (e.g., "2 hours ago", "3 days ago")
 *
 * @example
 * formatTimestamp(Date.now() - 3600000) // "about 1 hour ago"
 * formatTimestamp(Date.now() - 86400000) // "1 day ago"
 */
const formatTimestamp = (timestamp: number) => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
};

/**
 * Project Item Component
 *
 * Renders a compact list item for a single project with hover effects.
 * Used in the "Recent Projects" section below the Continue card.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Doc<"projects">} props.data - Project data to display
 * @returns {JSX.Element} Compact project list item
 *
 * @remarks
 * Features:
 * - Status icon (import state indicator)
 * - Project name with truncation
 * - Relative timestamp with hover effect
 * - Full row clickable for navigation
 * - Subtle hover state transitions
 */
const ProjectItem = ({ data }: { data: Doc<"projects"> }) => {
  return (
    <Link
      href={`/projects/${data._id}`}
      className="text-foreground/60 hover:text-foreground group flex w-full items-center justify-between py-1 text-sm font-medium"
    >
      <div className="flex items-center gap-2">
        {getProjectIcon({ project: data, size: "sm" })}
        <span className="truncate">{data.name}</span>
      </div>
      <span className="text-muted-foreground group-hover:text-foreground/60 text-xs transition-colors">
        {formatTimestamp(data.updatedAt)}
      </span>
    </Link>
  );
};

/**
 * Projects List Component
 *
 * Main component that displays a user's recent projects in a two-tier layout:
 * 1. Featured "Continue" card for the most recent project
 * 2. Compact list of other recent projects (up to 5 more)
 *
 * @component
 * @param {ProjectsListProps} props - Component props
 * @param {Function} props.onViewAll - Handler for "View All" action (typically opens command dialog)
 * @returns {JSX.Element} Complete projects list with continue card and recent items
 *
 * @example
 * <ProjectsList onViewAll={() => setCommandDialogOpen(true)} />
 *
 * @remarks
 * Loading State:
 * - Shows a spinner while projects are being fetched
 * - Returns early if data is undefined
 *
 * Layout Behavior:
 * - Fetches 6 most recent projects
 * - First project becomes the Continue card
 * - Remaining 5 shown in compact list
 * - "View All" button with ⌘K shortcut indicator
 * - Gracefully handles empty states (no projects or only one project)
 *
 * User Experience:
 * - Continue card encourages resuming recent work
 * - Quick access to other recent projects
 * - Keyboard shortcut (⌘K) for full project search
 * - Visual status indicators throughout
 */
export const ProjectsList = ({ onViewAll }: ProjectsListProps) => {
  // Fetch the 6 most recently updated projects
  const projects = useProjectsPartial(6);

  // Show loading spinner while data is being fetched
  if (projects === undefined) {
    return <Spinner className="text-ring size-4" />;
  }

  // Split projects: first one for Continue card, rest for list
  const [mostRecent, ...others] = projects;

  return (
    <div className="flex flex-col gap-4">
      {/* Show Continue card if there's at least one project */}
      {mostRecent && <ContinueCard data={mostRecent} />}

      {/* Show recent projects list if there are more than one project */}
      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">
              Recent Projects
            </span>
            <button
              onClick={onViewAll}
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs transition-colors"
            >
              <span>View all</span>
              <Kbd className="bg-accent border">⌘K</Kbd>
            </button>
          </div>
          <ul className="flex flex-col">
            {others.map((project) => (
              <ProjectItem key={project._id} data={project} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
