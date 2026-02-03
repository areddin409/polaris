import { useState } from "react";

import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";

import { cn } from "@/lib/utils";

import {
  useCreateFile,
  useCreateFolder,
  useFolderContents,
  useRenameFile,
  useDeleteFile,
} from "@/features/projects/hooks/use-files";

import { getItemPadding } from "./constants";
import { LoadingRow } from "./loading-row";
import { CreateInput } from "./create-input";
import { TreeItemWrapper } from "./tree-item-wrapper";
import { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { RenameInput } from "./rename-input";

/**
 * Tree Component
 *
 * Recursively renders a file tree structure with support for files and folders.
 * Handles file/folder creation, renaming, deletion, and selection. Supports
 * nested folder hierarchies with expand/collapse functionality.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Doc<"files">} props.item - The file or folder document to render
 * @param {number} [props.level=0] - The nesting level of this item in the tree (0 for root level)
 * @param {Id<"projects">} props.projectId - The ID of the parent project
 * @param {Id<"files"> | undefined} props.selectedFolderId - The ID of the currently selected folder
 * @param {Function} props.setSelectedFolderId - Function to update the selected folder ID
 * @param {"file" | "folder" | null} props.creating - The type of item being created by parent component
 * @param {Id<"files"> | undefined} props.creatingInFolderId - The folder ID where parent is creating a new item
 * @param {Function} props.onCreateComplete - Callback when parent creation is completed
 * @param {Function} props.onCreateCancel - Callback when parent creation is cancelled
 *
 * @returns {JSX.Element} Rendered tree node
 *
 * @example
 * ```tsx
 * <Tree
 *   item={fileOrFolder}
 *   level={0}
 *   projectId={projectId}
 *   selectedFolderId={selectedId}
 *   setSelectedFolderId={setSelectedId}
 *   creating={null}
 *   creatingInFolderId={undefined}
 *   onCreateComplete={handleCreate}
 *   onCreateCancel={handleCancel}
 * />
 * ```
 *
 * @remarks
 * - For files: Renders a single file item with rename and delete actions
 * - For folders: Renders expandable folder with nested contents, create actions, rename, and delete
 * - Automatically opens folders when creating items inside them
 * - Supports keyboard navigation and context menu actions
 * - Recursively renders nested items with increasing indentation levels
 */
export const Tree = ({
  item,
  level = 0,
  projectId,
  selectedFolderId,
  setSelectedFolderId,
  creating: parentCreating,
  creatingInFolderId,
  onCreateComplete,
  onCreateCancel,
}: {
  item: Doc<"files">;
  level?: number;
  projectId: Id<"projects">;
  selectedFolderId: Id<"files"> | undefined;
  setSelectedFolderId: (id: Id<"files"> | undefined) => void;
  creating: "file" | "folder" | null;
  creatingInFolderId: Id<"files"> | undefined;
  onCreateComplete: (name: string) => void;
  onCreateCancel: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);

  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const createFile = useCreateFile();
  const createFolder = useCreateFolder();

  const folderContents = useFolderContents({
    projectId,
    parentId: item._id,
    enabled: item.type === "folder" && isOpen,
  });

  const shouldShowCreateInput =
    parentCreating && creatingInFolderId === item._id;

  /**
   * Initiates the creation of a new file or folder within this folder
   * @param {"file" | "folder"} type - The type of item to create
   */
  const startCreating = (type: "file" | "folder") => {
    setIsOpen(true);
    setCreating(type);
  };

  /**
   * Handles the completion of creating a new file or folder
   * @param {string} name - The name of the new file or folder
   */
  const handleCreate = (name: string) => {
    setCreating(null);

    if (creating === "file") {
      createFile({
        projectId,
        name,
        content: "",
        parentId: item._id,
      });
    } else {
      createFolder({
        projectId,
        name,
        parentId: item._id,
      });
    }
  };

  /**
   * Handles renaming the current file or folder
   * @param {string} newName - The new name for the file or folder
   */
  const handleRename = (newName: string) => {
    setIsRenaming(false);

    if (newName === item.name) {
      return;
    }

    renameFile({ id: item._id, newName });
  };

  // Render file items
  if (item.type === "file") {
    const fileName = item.name;

    if (isRenaming) {
      return (
        <RenameInput
          type="file"
          defaultValue={fileName}
          level={level}
          onSubmit={handleRename}
          onCancel={() => setIsRenaming(false)}
        />
      );
    }

    return (
      <TreeItemWrapper
        item={item}
        level={level}
        isActive={false}
        onClick={() => {}}
        onDoubleClick={() => {}}
        onRename={() => setIsRenaming(true)}
        onDelete={() => {
          //TODO close tab
          deleteFile({ id: item._id });
        }}
      >
        <FileIcon fileName={fileName} autoAssign className="size-4" />
        <span className="truncate text-sm">{fileName}</span>
      </TreeItemWrapper>
    );
  }

  // Render folder items
  const folderName = item.name;
  const folderRender = (
    <>
      <div className="flex items-center gap-0.5">
        <ChevronRightIcon
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform duration-100 ease-in-out",
            isOpen && "rotate-90"
          )}
        />
        <FolderIcon folderName={folderName} className="size-4" />
      </div>
      <span className="truncate text-sm">{folderName}</span>
    </>
  );

  // Special render state: folder is actively creating a new item
  if (creating) {
    return (
      <>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="group hover:bg-accent/30 flex h-6 w-full items-center gap-1"
          style={{ paddingLeft: getItemPadding(level, false) }}
        >
          {folderRender}
        </button>
        {isOpen && (
          <>
            {folderContents === undefined && <LoadingRow level={level + 1} />}
            <CreateInput
              type={creating}
              level={level + 1}
              onSubmit={handleCreate}
              onCancel={() => setCreating(null)}
            />
            {folderContents?.map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                creating={parentCreating}
                creatingInFolderId={creatingInFolderId}
                onCreateComplete={onCreateComplete}
                onCreateCancel={onCreateCancel}
              />
            ))}
          </>
        )}
      </>
    );
  }

  // Special render state: folder is being renamed
  if (isRenaming) {
    return (
      <>
        <RenameInput
          type="folder"
          defaultValue={folderName}
          level={level}
          onSubmit={handleRename}
          onCancel={() => setIsRenaming(false)}
        />
        {isOpen && (
          <>
            {folderContents === undefined && <LoadingRow level={level + 1} />}

            {folderContents?.map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                creating={parentCreating}
                creatingInFolderId={creatingInFolderId}
                onCreateComplete={onCreateComplete}
                onCreateCancel={onCreateCancel}
              />
            ))}
          </>
        )}
      </>
    );
  }

  // Default render: normal folder with full interaction
  return (
    <>
      <TreeItemWrapper
        item={item}
        level={level}
        isActive={selectedFolderId === item._id}
        onClick={() => {
          setSelectedFolderId(item._id);
          setIsOpen((prev) => !prev);
        }}
        onDoubleClick={() => {}}
        onRename={() => setIsRenaming(true)}
        onDelete={() => {
          deleteFile({ id: item._id });
        }}
        onCreateFile={() => startCreating("file")}
        onCreateFolder={() => startCreating("folder")}
      >
        {folderRender}
      </TreeItemWrapper>
      {isOpen && (
        <>
          {folderContents === undefined && <LoadingRow level={level + 1} />}
          {shouldShowCreateInput && (
            <CreateInput
              type={parentCreating!}
              level={level + 1}
              onSubmit={onCreateComplete}
              onCancel={onCreateCancel}
            />
          )}
          {creating && (
            <CreateInput
              type={creating}
              level={level + 1}
              onSubmit={handleCreate}
              onCancel={() => setCreating(null)}
            />
          )}

          {folderContents
            ?.slice()
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "folder" ? -1 : 1;
            })
            .map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                creating={parentCreating}
                creatingInFolderId={creatingInFolderId}
                onCreateComplete={onCreateComplete}
                onCreateCancel={onCreateCancel}
              />
            ))}
        </>
      )}
    </>
  );
};
