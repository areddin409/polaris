"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

const Page = () => {
  const projects = useQuery(api.projects.get);

  const createProject = useMutation(api.projects.create);

  return (
    <div className="flex flex-col gap-2 p-4">
      <Button onClick={() => createProject({ name: "New Project" })}>Create Project</Button>
      <h1 className="mb-4 text-2xl font-bold">Projects</h1>
      {projects?.map((project) => (
        <div key={project._id.toString()} className="rounded-md border p-4">
          <h2 className="text-xl font-semibold">{project.name}</h2>
          <p className="text-sm text-gray-500">Owner ID: {project.ownerId}</p>
        </div>
      ))}
    </div>
  );
};

export default Page;
