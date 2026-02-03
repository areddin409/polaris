/**
 * Mobile Detection Hook
 *
 * A React hook that detects whether the current viewport is below the mobile breakpoint
 * and updates reactively as the window is resized.
 *
 * @module hooks/use-mobile
 */

import * as React from "react"

/**
 * Mobile breakpoint in pixels (matches Tailwind's md breakpoint)
 * Viewports below this width are considered mobile
 * @constant {number}
 */
const MOBILE_BREAKPOINT = 768

/**
 * Use Is Mobile Hook
 *
 * Detects if the current viewport width is below the mobile breakpoint (768px).
 * Updates automatically when the window is resized. Uses a media query listener
 * for efficient change detection.
 *
 * @hook
 * @returns {boolean} true if viewport is below mobile breakpoint, false otherwise
 *
 * @example
 * function ResponsiveComponent() {
 *   const isMobile = useIsMobile();
 *
 *   return (
 *     <div>
 *       {isMobile ? (
 *         <MobileNav />
 *       ) : (
 *         <DesktopNav />
 *       )}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Conditionally render different layouts
 * function Dashboard() {
 *   const isMobile = useIsMobile();
 *
 *   return isMobile ? <StackedLayout /> : <SidebarLayout />;
 * }
 *
 * @remarks
 * Implementation Details:
 * - Uses `window.matchMedia()` for efficient media query detection
 * - Adds event listener for viewport changes
 * - Cleans up listener on component unmount
 * - Initial value is undefined until first effect runs
 * - Returns boolean (false if undefined via `!!isMobile`)
 *
 * Performance:
 * - Uses native media query listener (more efficient than resize events)
 * - Only re-renders when crossing the breakpoint threshold
 * - Shared breakpoint constant with Tailwind config
 *
 * Breakpoint:
 * - Mobile: < 768px (Tailwind's md breakpoint)
 * - Desktop: >= 768px
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
