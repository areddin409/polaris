/**
 * Projects Command Dialog Component
 *
 * A searchable command palette dialog for quickly finding and navigating to projects.
 * Provides keyboard-driven navigation with fuzzy search capabilities.
 *
 * @module features/projects/components/projects-command-dialog
 */

import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import { AlertCircleIcon, GlobeIcon, Loader2Icon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useProjects } from "../hooks/use-projects";
import { getProjectIcon } from "../utils/get-project-icon";

/**
 * Props for ProjectsCommandDialog component
 *
 * @interface ProjectsCommandDialogProps
 * @property {boolean} open - Controls whether the dialog is visible
 * @property {(open: boolean) => void} onOpenChange - Callback when dialog open state changes
 */
interface ProjectsCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Projects Command Dialog
 *
 * A searchable modal dialog that displays all user projects with keyboard navigation.
 * Enables quick access to any project through fuzzy search and keyboard shortcuts.
 *
 * @component
 * @param {ProjectsCommandDialogProps} props - Component props
 * @param {boolean} props.open - Whether the dialog is currently open
 * @param {Function} props.onOpenChange - Handler for dialog state changes
 * @returns {JSX.Element} Searchable command dialog with project list
 *
 * @example
 * const [isOpen, setIsOpen] = useState(false);
 *
 * // Open with ⌘K shortcut
 * useEffect(() => {
 *   const handleKeyDown = (e: KeyboardEvent) => {
 *     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 *       e.preventDefault();
 *       setIsOpen(true);
 *     }
 *   };
 *   window.addEventListener('keydown', handleKeyDown);
 *   return () => window.removeEventListener('keydown', handleKeyDown);
 * }, []);
 *
 * return (
 *   <ProjectsCommandDialog
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *   />
 * );
 *
 * @remarks
 * Features:
 * - Fuzzy search across project names
 * - Keyboard navigation (arrow keys, enter to select)
 * - Visual status indicators (GitHub, loading, error, default)
 * - Auto-navigation on project selection
 * - Automatic dialog close after selection
 *
 * Keyboard Shortcuts:
 * - `↑/↓` - Navigate through projects
 * - `Enter` - Select and navigate to project
 * - `Esc` - Close dialog
 */
export const ProjectsCommandDialog = ({
  open,
  onOpenChange,
}: ProjectsCommandDialogProps) => {
  const router = useRouter();
  const projects = useProjects();

  /**
   * Handle project selection
   * Navigates to the selected project and closes the dialog
   *
   * @param {string} projectId - ID of the selected project
   */
  const handleSelect = (projectId: string) => {
    router.push(`/projects/${projectId}`);
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Projects"
      description="Search and navigate to your projects"
    >
      <CommandInput placeholder="Search projects..." />
      <CommandList>
        <CommandEmpty>No projects found.</CommandEmpty>
        <CommandGroup heading="Projects">
          {projects?.map((project) => (
            <CommandItem
              key={project._id}
              value={`${project.name}-${project._id}`}
              onSelect={() => handleSelect(project._id)}
            >
              {getProjectIcon({ project })}
              <span>{project.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
