/**
 * Create Input Component
 *
 * An inline input component for creating new files and folders in the file tree.
 * Provides auto-focus, dynamic icon updates based on input value, and keyboard controls.
 *
 * @module features/projects/components/file-explorer/create-input
 */

import { useState } from "react";

import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { getItemPadding } from "./constants";

/**
 * Props for CreateInput component
 *
 * @interface CreateInputProps
 * @property {"file" | "folder"} type - The type of item being created
 * @property {number} level - Nesting level in the tree for proper indentation
 * @property {(name: string) => void} onSubmit - Callback when creation is submitted with the new name
 * @property {() => void} onCancel - Callback when creation is canceled
 */

/**
 * Create Input
 *
 * An inline input for creating new files and folders with real-time icon preview.
 * Automatically focuses on mount and provides keyboard shortcuts for submission and cancellation.
 *
 * @component
 * @param {CreateInputProps} props - Component props
 * @returns {JSX.Element} Inline input with dynamic file/folder icon
 *
 * @example
 * // Create a new file at root level
 * <CreateInput
 *   type="file"
 *   level={0}
 *   onSubmit={(name) => handleCreateFile(name)}
 *   onCancel={() => setCreating(null)}
 * />
 *
 * @example
 * // Create a new folder at nested level
 * <CreateInput
 *   type="folder"
 *   level={2}
 *   onSubmit={(name) => handleCreateFolder(parentId, name)}
 *   onCancel={() => setCreating(null)}
 * />
 *
 * @remarks
 * Features:
 * - Auto-focus on mount for immediate typing
 * - Dynamic icon that updates as user types (shows file type or folder icon)
 * - Enter to submit creation
 * - Escape to cancel
 * - Blur also triggers submission
 * - Empty input cancels creation (doesn't submit)
 * - Whitespace is automatically trimmed
 * - Matches tree indentation with dynamic padding
 *
 * Behavior:
 * - Only submits if input has content after trimming
 * - Empty or whitespace-only input cancels the operation
 * - File icons update based on file extension (e.g., .ts shows TypeScript icon)
 */
export const CreateInput = ({
  type,
  level,
  onSubmit,
  onCancel,
}: {
  type: "file" | "folder";
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState("");

  /**
   * Handle creation submission
   * Trims input value and only submits if non-empty, otherwise cancels
   */
  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
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
          <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
        )}

        {type === "file" && (
          <FileIcon fileName={value} autoAssign className="size-4" />
        )}

        {type === "folder" && (
          <FolderIcon folderName={value} className="size-4" />
        )}
      </div>
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSubmit}
        className="focus:ring-ring flex-1 bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }

          if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
    </div>
  );
};
