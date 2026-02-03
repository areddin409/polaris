/**
 * Utility Functions
 *
 * Common utility functions used throughout the application.
 * Currently provides class name merging for Tailwind CSS.
 *
 * @module lib/utils
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class Name Utility
 *
 * Merges multiple class names and resolves Tailwind CSS conflicts.
 * Combines clsx for conditional classes with tailwind-merge for
 * proper Tailwind class precedence handling.
 *
 * @function cn
 * @param {...ClassValue[]} inputs - Any number of class values to merge.
 *   Can be strings, objects, arrays, or any value accepted by clsx.
 * @returns {string} A single merged class name string with conflicts resolved
 *
 * @example
 * // Basic usage
 * cn('px-4', 'py-2', 'bg-blue-500')
 * // Returns: "px-4 py-2 bg-blue-500"
 *
 * @example
 * // Conditional classes
 * cn('text-base', isActive && 'font-bold', isPrimary ? 'text-blue-500' : 'text-gray-500')
 * // Returns: "text-base font-bold text-blue-500" (if both conditions true)
 *
 * @example
 * // Tailwind conflict resolution
 * cn('px-2 py-1', 'px-4')
 * // Returns: "py-1 px-4" (later px-4 overrides px-2)
 *
 * @example
 * // With component props
 * function Button({ className, variant }) {
 *   return (
 *     <button
 *       className={cn(
 *         'px-4 py-2 rounded',
 *         variant === 'primary' && 'bg-blue-500',
 *         className
 *       )}
 *     />
 *   );
 * }
 *
 * @remarks
 * This utility is essential for:
 * - Merging base component classes with prop-based overrides
 * - Resolving Tailwind class conflicts (e.g., px-2 vs px-4)
 * - Handling conditional classes cleanly
 * - Preventing duplicate classes
 *
 * How it works:
 * 1. clsx: Handles conditional class logic and array/object syntax
 * 2. tailwind-merge: Resolves Tailwind-specific class conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
