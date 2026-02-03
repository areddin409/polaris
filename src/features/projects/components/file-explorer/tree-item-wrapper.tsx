/**
 * Tree Item Wrapper Component
 *
 * A wrapper component that provides context menu functionality and interactive behavior
 * for both file and folder items in the file tree. Handles click events, keyboard shortcuts,
 * and renders action menus for rename, delete, and create operations.
 *
 * @module features/projects/components/file-explorer/tree-item-wrapper
 */

import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuShortcut,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

import { getItemPadding } from "./constants";
import { Doc } from "../../../../../convex/_generated/dataModel";

/**
 * Props for TreeItemWrapper component
 *
 * @interface TreeItemWrapperProps
 * @property {Doc<"files">} item - The file or folder document from Convex
 * @property {React.ReactNode} children - Child elements to render (typically file/folder icon and name)
 * @property {number} level - Nesting level in the tree (0 = root level)
 * @property {boolean} [isActive] - Whether this item is currently selected/active
 * @property {() => void} [onClick] - Handler for click events
 * @property {() => void} [onDoubleClick] - Handler for double-click events
 * @property {() => void} [onRename] - Handler to initiate rename operation
 * @property {() => void} [onDelete] - Handler to delete the item
 * @property {() => void} [onCreateFile] - Handler to create a new file (folders only)
 * @property {() => void} [onCreateFolder] - Handler to create a new folder (folders only)
 */
export const TreeItemWrapper = ({
  item,
  children,
  level,
  isActive,
  onClick,
  onDoubleClick,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
}: {
  item: Doc<"files">;
  children: React.ReactNode;
  level: number;
  isActive?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  /**
   * Tree Item Wrapper
   *
   * Wraps a tree item with context menu and interactive behavior. Provides a consistent
   * interface for file and folder actions including rename, delete, and create operations.
   *
   * @component
   * @param {TreeItemWrapperProps} props - Component props
   * @returns {JSX.Element} Interactive button with context menu wrapper
   *
   * @example
   * <TreeItemWrapper
   *   item={fileDoc}
   *   level={1}
   *   isActive={selectedId === fileDoc._id}
   *   onClick={() => handleSelect(fileDoc._id)}
   *   onRename={() => setRenaming(true)}
   *   onDelete={() => handleDelete(fileDoc._id)}
   * >
   *   <FileIcon fileName={fileDoc.name} />
   *   <span>{fileDoc.name}</span>
   * </TreeItemWrapper>
   *
   * @remarks
   * Features:
   * - Right-click context menu with actions (rename, delete, create)
   * - Keyboard shortcut: Enter to rename
   * - Dynamic padding based on tree level and item type
   * - Visual feedback on hover and active states
   * - Folders show additional "New File/Folder" options in context menu
   *
   * Keyboard Shortcuts:
   * - `Enter` - Initiate rename
   * - `⌘Backspace` - Delete item
   */
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRename?.();
            }
          }}
          className={cn(
            "group hover:bg-accent/30 focus:ring-ring flex h-5.5 w-full items-center gap-1 outline-none focus:ring-1 focus:ring-inset",
            isActive && "bg-accent/30"
          )}
          style={{ paddingLeft: getItemPadding(level, item.type === "file") }}
        >
          {children}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-64"
      >
        {item.type === "folder" && (
          <>
            <ContextMenuItem onClick={onCreateFile} className="text-sm">
              New File...
            </ContextMenuItem>
            <ContextMenuItem onClick={onCreateFolder} className="text-sm">
              New Folder...
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={onRename} className="text-sm">
          Rename...
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onDelete} className="text-sm">
          Delete Permanently
          <ContextMenuShortcut>⌘Backspace</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
