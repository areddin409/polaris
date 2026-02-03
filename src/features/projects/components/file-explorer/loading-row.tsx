/**
 * Loading Row Component
 *
 * A loading indicator row for the file tree that displays a spinner
 * with proper indentation to match the tree structure.
 *
 * @module features/projects/components/file-explorer/loading-row
 */

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

import { getItemPadding } from "./constants";

/**
 * Props for LoadingRow component
 *
 * @interface LoadingRowProps
 * @property {string} [className] - Additional CSS classes to apply
 * @property {number} [level] - Nesting level in the tree for proper indentation (default: 0)
 */

/**
 * Loading Row
 *
 * Displays a spinner in the file tree to indicate loading state.
 * Respects tree indentation to appear at the correct nesting level.
 *
 * @component
 * @param {LoadingRowProps} props - Component props
 * @returns {JSX.Element} Loading indicator with tree indentation
 *
 * @example
 * // Show loading at root level
 * <LoadingRow />
 *
 * @example
 * // Show loading at nested level
 * <LoadingRow level={2} />
 *
 * @example
 * // With custom styling
 * <LoadingRow className="my-4" level={1} />
 *
 * @remarks
 * - Uses the same padding calculation as tree items for alignment
 * - Default level is 0 (root level)
 * - Spinner color matches the theme's ring color
 * - Height (h-6) matches standard tree row height
 */
export const LoadingRow = ({
  className,
  level,
}: {
  className?: string;
  level?: number;
}) => {
  return (
    <div
      className={cn("text-muted-foreground flex h-6 items-center", className)}
      style={{ paddingLeft: getItemPadding(level ?? 0, true) }}
    >
      <Spinner className="text-ring ml-0.5 size-4" />
    </div>
  );
};
