import { useState } from "react";
import {
  ChevronRightIcon,
  CopyMinusIcon,
  FilePlusCornerIcon,
  FolderPlusIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useProject } from "../../hooks/use-projects";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  useCreateFolder,
  useCreateFile,
  useFolderContents,
} from "../../hooks/use-files";
import { CreateInput } from "./create-input";
import { LoadingRow } from "./loading-row";
import { Tree } from "./tree";

/**
 * FileExplorer Component
 *
 * Main file explorer interface for a project. Displays a hierarchical tree view
 * of all files and folders in the project with support for creating, renaming,
 * deleting, and navigating items. Features a collapsible header with quick actions
 * for creating new files/folders and collapsing all folders.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Id<"projects">} props.projectId - The ID of the project to display files for
 *
 * @returns {JSX.Element} File explorer interface
 *
 * @example
 * ```tsx
 * <FileExplorer projectId={projectId} />
 * ```
 *
 * @remarks
 * **Features:**
 * - Hierarchical tree view with expand/collapse functionality
 * - Quick action buttons in header (appear on hover):
 *   - New File: Creates a file in the selected folder (or root if none selected)
 *   - New Folder: Creates a folder in the selected folder (or root if none selected)
 *   - Collapse All: Collapses all expanded folders
 * - Folder selection: Click a folder to select it (affects where new items are created)
 * - Context menu actions for each item (rename, delete, create within folder)
 * - Automatic sorting: Folders appear first, then files, both alphabetically
 * - Visual feedback for selected folders
 * - Loading states for async operations
 *
 * **State Management:**
 * - `isOpen`: Controls whether the entire tree is expanded or collapsed
 * - `collapseKey`: Forces re-render to collapse all folders when incremented
 * - `creating`: Tracks what type of item is being created ("file" | "folder" | null)
 * - `selectedFolderId`: ID of the currently selected folder
 * - `creatingInFolderId`: ID of the folder where a new item is being created
 */
export const FileExplorer = ({ projectId }: { projectId: Id<"projects"> }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [collapseKey, setCollapseKey] = useState(0);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<
    Id<"files"> | undefined
  >(undefined);
  const [creatingInFolderId, setCreatingInFolderId] = useState<
    Id<"files"> | undefined
  >(undefined);

  const project = useProject(projectId);
  const rootFiles = useFolderContents({
    projectId,
    enabled: isOpen,
  });

  const createFile = useCreateFile();
  const createFolder = useCreateFolder();

  /**
   * Handles the creation of a new file or folder
   * @param {string} name - The name of the new file or folder
   * @remarks
   * - Creates the item in the selected folder if one is selected
   * - Creates at root level if no folder is selected
   * - Resets creation state after completion
   */
  const handleCreate = (name: string) => {
    setCreating(null);
    setCreatingInFolderId(undefined);

    if (creating === "file") {
      createFile({
        projectId,
        name,
        content: "",
        parentId: selectedFolderId,
      });
    } else {
      createFolder({
        projectId,
        name,
        parentId: selectedFolderId,
      });
    }
  };

  return (
    <div className="bg-sidebar h-full">
      <ScrollArea>
        {/* Project header with expand/collapse and quick actions */}
        <div
          role="button"
          onClick={() => setIsOpen((value) => !value)}
          className="group/project bg-accent flex h-5.5 w-full cursor-pointer items-center gap-0.5 text-left font-bold"
        >
          <ChevronRightIcon
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform duration-100 ease-in-out",
              isOpen && "rotate-90"
            )}
          />
          <p className="line-clamp-1 text-xs uppercase">
            {project?.name ?? "Loading..."}
          </p>
          {/* Quick action buttons - visible on hover */}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-none duration-0 group-hover/project:opacity-100">
            {/* Action buttons */}
            {/* new file */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsOpen(true);
                setCreating("file");
                setCreatingInFolderId(selectedFolderId);
              }}
              variant="highlight"
              size="icon-xs"
              title="New File"
            >
              <FilePlusCornerIcon className="size-3.5" />
            </Button>
            {/* new folder */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsOpen(true);
                setCreating("folder");
                setCreatingInFolderId(selectedFolderId);
              }}
              variant="highlight"
              size="icon-xs"
              title="New Folder"
            >
              <FolderPlusIcon className="size-3.5" />
            </Button>
            {/* collapse all */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setCollapseKey((prev) => prev + 1);
              }}
              variant="highlight"
              size="icon-xs"
              title="Collapse All"
            >
              <CopyMinusIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        {/* File tree */}
        {isOpen && (
          <>
            {rootFiles === undefined && <LoadingRow level={0} />}
            {/* Show CreateInput at root level if no folder is selected */}
            {creating && creatingInFolderId === undefined && (
              <CreateInput
                type={creating}
                level={0}
                onSubmit={handleCreate}
                onCancel={() => {
                  setCreating(null);
                  setCreatingInFolderId(undefined);
                }}
              />
            )}
            {/* Render all root-level files and folders */}
            {rootFiles?.map((item) => (
              <Tree
                key={`${item._id}-${collapseKey}`}
                item={item}
                level={0}
                projectId={projectId}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                creating={creating}
                creatingInFolderId={creatingInFolderId}
                onCreateComplete={handleCreate}
                onCreateCancel={() => {
                  setCreating(null);
                  setCreatingInFolderId(undefined);
                }}
              />
            ))}
          </>
        )}
      </ScrollArea>
    </div>
  );
};
