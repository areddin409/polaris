const ProjectIdPage = async ({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) => {
  const { projectId } = await params;
  return <div>ProjectId: {projectId} </div>;
};

export default ProjectIdPage;
