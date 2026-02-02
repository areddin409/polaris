"use client";

import { Id } from "../../../../convex/_generated/dataModel";
import Navbar from "./navbar";

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
      {children}
    </div>
  );
};

export default ProjectIdLayout;
