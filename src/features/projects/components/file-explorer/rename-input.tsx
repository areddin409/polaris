/**
 * Rename Input Component
 *
 * An inline input component for renaming files and folders in the file tree.
 * Provides smart text selection behavior, auto-focus, and keyboard controls
 * for a seamless rename experience.
 *
 * @module features/projects/components/file-explorer/rename-input
 */

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { getItemPadding } from "./constants";
import { cn } from "@/lib/utils";

/**
 * Props for RenameInput component
 *
 * @interface RenameInputProps
 * @property {"file" | "folder"} type - The type of item being renamed
 * @property {string} defaultValue - The current name of the item
 * @property {boolean} [isOpen] - Whether the folder is expanded (folders only)
 * @property {number} level - Nesting level in the tree for proper indentation
 * @property {(name: string) => void} onSubmit - Callback when rename is submitted
 * @property {() => void} onCancel - Callback when rename is cancelled
 */
export const RenameInput = ({
  type,
  defaultValue,
  isOpen,
  level,
  onSubmit,
  onCancel,
}: {
  type: "file" | "folder";
  defaultValue: string;
  isOpen?: boolean;
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
/**
 * Rename Input
 *
 * An inline input for renaming files and folders with intelligent text selection.
 * For files, selects the name without extension. For folders, selects the entire name.
 *
 * @component
 * @param {RenameInputProps} props - Component props
 * @returns {JSX.Element} Inline input with file/folder icon
 *
 * @example
 * <RenameInput
 *   type="file"
 *   defaultValue="script.ts"
 *   level={1}
 *   onSubmit={(name) => handleRename(fileId, name)}
 *   onCancel={() => setRenaming(false)}
 * />
 *
 * @remarks
 * Features:
 * - Auto-focus on mount
 * - Smart text selection (excludes file extension for files)
 * - Enter to submit, Escape to cancel
 * - Blur triggers submit (trims whitespace, falls back to default)
 * - Dynamic icon updates based on input value
 * - Matches tree indentation with dynamic padding
 *
 * Behavior:
 * - **Files**: Selects name portion only (e.g., "script" in "script.ts")
 * - **Folders**: Selects entire name
 * - Empty input reverts to original name
 * - Whitespace is automatically trimmed
 */
}) => {
  const [value, setValue] = useState(defaultValue);

  /**
   * Handle rename submission
   * Trims input value and falls back to defaultValue if empty
   */
  const handleSubmit = () => {
    const trimmedValue = value.trim() || defaultValue;
    onSubmit(trimmedValue);
  };

  /**
   * Handle input focus with smart selection
   * For files: selects name without extension
   * For folders: selects entire name
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (type === "folder") {
      e.currentTarget.select();
    } else {
      const value = e.currentTarget.value;
      const lastDotIndex = value.lastIndexOf(".");
      if (lastDotIndex > 0) {
        e.currentTarget.setSelectionRange(0, lastDotIndex);
      } else {
        e.currentTarget.select();
      }
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };
  return (
    <div
      className="bg-accent/30 flex h-6 w-full items-center gap-1"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <div className="flex items-center gap-0.5">
        {type === "folder" && (
          <ChevronRightIcon
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform duration-100 ease-in-out",
              isOpen && "rotate-90"
            )}
          />
        )}
        {type === "file" && (
          <FileIcon fileName={value} autoAssign className="size-4" />
        )}
        {type === "folder" && (
          <FolderIcon className="size-4" folderName={value} />
        )}
      </div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="focus:ring-ring flex-1 bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset"
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      />
    </div>
  );
};
