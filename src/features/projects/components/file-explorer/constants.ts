/**
 * File Explorer Constants
 *
 * Constants and utilities for calculating tree item padding and indentation
 * in the file explorer component.
 *
 * @module features/projects/components/file-explorer/constants
 */

/**
 * Base left padding for all tree items in pixels
 * @constant {number}
 */
export const BASE_PADDING = 12;

/**
 * Additional left padding per nesting level in pixels
 * @constant {number}
 */
export const LEVEL_PADDING = 12;

/**
 * Calculate Item Padding
 *
 * Calculates the left padding for a tree item based on its nesting level and type.
 * Files receive extra padding since they don't have a chevron icon like folders.
 *
 * @function getItemPadding
 * @param {number} level - The nesting level (0 = root level, 1 = first nested level, etc.)
 * @param {boolean} isFile - Whether the item is a file (true) or folder (false)
 * @returns {number} The calculated left padding in pixels
 *
 * @example
 * // Root folder (has chevron)
 * getItemPadding(0, false); // Returns 12
 *
 * @example
 * // Root file (no chevron, needs extra offset)
 * getItemPadding(0, true); // Returns 28 (12 + 16)
 *
 * @example
 * // Nested folder at level 2
 * getItemPadding(2, false); // Returns 36 (12 + 2*12)
 *
 * @example
 * // Nested file at level 2
 * getItemPadding(2, true); // Returns 52 (12 + 2*12 + 16)
 *
 * @remarks
 * The padding calculation formula:
 * - Base: `BASE_PADDING` (12px)
 * - Level: `level * LEVEL_PADDING` (level * 12px)
 * - File offset: `16px` (only for files)
 *
 * Result: `BASE_PADDING + (level * LEVEL_PADDING) + (isFile ? 16 : 0)`
 */
export const getItemPadding = (level: number, isFile: boolean) => {
  // files need extra padding since they don't have a chevron icon
  const fileOffset = isFile ? 16 : 0;
  return BASE_PADDING + level * LEVEL_PADDING + fileOffset;
};
