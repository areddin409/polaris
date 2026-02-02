"use client";
import { Allotment } from "allotment";

import { Id } from "../../../../convex/_generated/dataModel";
import Navbar from "./navbar";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 400;
const DEFAULT_MAIN_SIZE = 1000;

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
            <div>Conversation Sidebar</div>
          </Allotment.Pane>
          <Allotment.Pane>{children}</Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default ProjectIdLayout;
