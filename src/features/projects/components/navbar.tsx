/**
 * Navbar Component
 *
 * The top navigation bar for project pages. Displays project breadcrumbs,
 * inline rename functionality, save status, and user account controls.
 *
 * @module features/projects/components/navbar
 */

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Poppins } from "next/font/google";
import { UserButton } from "@clerk/nextjs";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Id } from "../../../../convex/_generated/dataModel";
import { useProject, useRenameProject } from "../hooks/use-projects";
import { CloudCheckIcon, LoaderIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Props for Navbar component
 *
 * @interface NavbarProps
 * @property {Id<"projects">} projectId - The unique identifier of the current project
 */

/**
 * Navbar
 *
 * Top navigation bar for project pages with breadcrumb navigation, inline project rename,
 * save status indicator, and user account button.
 *
 * @component
 * @param {NavbarProps} props - Component props
 * @returns {JSX.Element} Navigation bar with breadcrumbs and user controls
 *
 * @example
 * <Navbar projectId="k1234567890abcdef" />
 *
 * @remarks
 * Features:
 * - Breadcrumb navigation: Home (Polaris logo) → Project name
 * - Click project name to enter rename mode
 * - Inline rename with input field (Enter to save, Escape to cancel)
 * - Real-time save status with last saved time
 * - Visual indicator for import operations in progress
 * - User account button for authentication
 *
 * Rename Behavior:
 * - Click on project name to activate rename mode
 * - Input auto-selects text for quick editing
 * - Enter key submits the rename
 * - Escape key cancels (using renameCanceledRef to prevent submission)
 * - Blur also submits unless canceled
 * - Empty/whitespace names are rejected
 * - No change if new name matches current name
 *
 * Status Indicators:
 * - **Importing**: Animated spinner with "Importing project..." tooltip
 * - **Saved**: Cloud check icon with relative time ("Saved 2 minutes ago")
 */
const Navbar = ({ projectId }: { projectId: Id<"projects"> }) => {
  const project = useProject(projectId);
  const renameProject = useRenameProject();

  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState("");
  const renameCanceledRef = useRef(false);

  /**
   * Start rename mode
   * Sets the input value to current project name and activates rename mode
   */
  const handleStartRename = () => {
    if (!project) return;
    setName(project.name);
    setIsRenaming(true);
    renameCanceledRef.current = false; // Reset cancel flag when starting rename
  };

  /**
   * Submit the rename
   * Checks if rename was canceled, validates the new name, and submits if valid
   */
  const handleSubmit = () => {
    // Check if rename was canceled (e.g., by Escape key)
    if (renameCanceledRef.current) {
      renameCanceledRef.current = false; // Reset flag
      return;
    }

    setIsRenaming(false);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === project?.name) return;

    renameProject({ id: projectId, name: trimmedName });
  };

  /**
   * Handle keyboard shortcuts
   * Enter: submit rename
   * Escape: cancel rename (sets cancel flag to prevent blur submission)
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      renameCanceledRef.current = true; // Set cancel flag
      setIsRenaming(false);
    }
  };

  return (
    <nav className="bg-sidebar flex items-center justify-between gap-x-2 border-b p-2">
      <div className="flex items-center gap-x-2">
        <Breadcrumb>
          <BreadcrumbList className="gap-0!">
            <BreadcrumbItem>
              <BreadcrumbLink className="flex items-center gap-1.5" asChild>
                <Button
                  variant={"ghost"}
                  className="h-7! w-fit! p-1.5!"
                  asChild
                >
                  <Link href="/">
                    <Image src="/logo.svg" alt="Logo" width={20} height={20} />
                    <span className={cn("text-sm font-medium", font.className)}>
                      Polaris
                    </span>
                  </Link>
                </Button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="mr-1 ml-0!" />
            <BreadcrumbItem>
              {isRenaming ? (
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={handleSubmit}
                  onKeyDown={handleKeyDown}
                  className="text-foreground focus:ring-ring max-w-40 truncate bg-transparent text-sm font-medium outline-none focus:ring-1 focus:ring-inset"
                />
              ) : (
                <BreadcrumbPage
                  onClick={handleStartRename}
                  className="hover:text-primary max-w-40 cursor-pointer truncate text-sm font-medium"
                >
                  {project?.name || "Loading..."}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {project?.importStatus === "importing" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <LoaderIcon className="text-muted-foreground size-4 animate-spin" />
            </TooltipTrigger>
            <TooltipContent>Importing project...</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <CloudCheckIcon className="text-muted-foreground size-4" />
            </TooltipTrigger>
            <TooltipContent>
              Saved{" "}
              {project?.updatedAt
                ? formatDistanceToNow(project.updatedAt, { addSuffix: true })
                : "Loading..."}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2">
        <UserButton />
      </div>
    </nav>
  );
};

export default Navbar;
