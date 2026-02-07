/**
 * Project ID Layout Component
 *
 * The main layout wrapper for individual project pages. Provides a split-pane interface
 * with a resizable conversation sidebar and main content area.
 *
 * @module features/projects/components/project-id-layout
 */

"use client";
import { Allotment } from "allotment";

import { Id } from "../../../../convex/_generated/dataModel";
import Navbar from "./navbar";
import { ConversationSidebar } from "@/features/conversations/components/conversation-sidebar";

/**
 * Minimum width for the conversation sidebar in pixels
 * @constant {number}
 */
const MIN_SIDEBAR_WIDTH = 200;

/**
 * Maximum width for the conversation sidebar in pixels
 * @constant {number}
 */
const MAX_SIDEBAR_WIDTH = 800;

/**
 * Default/preferred width for the conversation sidebar in pixels
 * @constant {number}
 */
const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 400;

/**
 * Default size for the main content area in pixels
 * @constant {number}
 */
const DEFAULT_MAIN_SIZE = 1000;

/**
 * Props for ProjectIdLayout component
 *
 * @interface ProjectIdLayoutProps
 * @property {Id<"projects">} projectId - The unique identifier of the current project
 * @property {React.ReactNode} children - The main content to render in the right pane
 */

/**
 * Project ID Layout
 *
 * A two-pane layout for project pages with a resizable conversation sidebar on the left
 * and main content on the right. Includes the project navbar at the top.
 *
 * @component
 * @param {ProjectIdLayoutProps} props - Component props
 * @returns {JSX.Element} Full-height layout with navbar and split panes
 *
 * @example
 * <ProjectIdLayout projectId={projectId}>
 *   <FileExplorer projectId={projectId} />
 * </ProjectIdLayout>
 *
 * @remarks
 * Layout Structure:
 * - **Navbar**: Fixed at top with breadcrumbs and user controls
 * - **Conversation Sidebar**: Left pane (200-800px, default 400px)
 * - **Main Content**: Right pane (flexible, grows to fill space)
 *
 * Resize Behavior:
 * - Users can drag the divider to resize panes
 * - Sidebar snaps to boundaries when dragged to min/max
 * - Preferred size is restored on reload (via Allotment)
 * - Main content fills remaining space
 *
 * Size Constraints:
 * - Sidebar: 200px minimum, 800px maximum, 400px preferred
 * - Main: Flexible, starts at 1000px default size
 * - Total layout fills viewport height (h-screen)
 */
const ProjectIdLayout = ({
  projectId,
  children,
}: {
  projectId: Id<"projects">;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex h-screen w-full flex-col">
      <Navbar projectId={projectId} />
      <div className="flex flex-1 overflow-hidden">
        <Allotment
          className="flex-1"
          defaultSizes={[DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}
        >
          <Allotment.Pane
            snap
            minSize={MIN_SIDEBAR_WIDTH}
            maxSize={MAX_SIDEBAR_WIDTH}
            preferredSize={DEFAULT_CONVERSATION_SIDEBAR_WIDTH}
          >
            <ConversationSidebar projectId={projectId} />
          </Allotment.Pane>
          <Allotment.Pane>{children}</Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default ProjectIdLayout;
