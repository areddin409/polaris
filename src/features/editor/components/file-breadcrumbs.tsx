import React from "react";
import { FileIcon } from "@react-symbols/icons/utils";

import { Id } from "../../../../convex/_generated/dataModel";

import { useEditor } from "@/features/editor/hooks/use-editor";
import { useFilePath } from "@/features/projects/hooks/use-files";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const FileBreadcrumbs = ({
  projectId,
}: {
  projectId: Id<"projects">;
}) => {
  const { activeTabId } = useEditor(projectId);
  const filePath = useFilePath(activeTabId);

  if (filePath === undefined || !activeTabId) {
    return (
      <div className="bg-background border-b p-2 pl-4">
        <Breadcrumb>
          <BreadcrumbList className="gap-0.5">
            <BreadcrumbItem className="text-sm">
              <BreadcrumbPage>&nbsp;</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    );
  }

  return (
    <div className="bg-background border-b p-2 pl-4">
      <Breadcrumb>
        <BreadcrumbList className="gap-0.5">
          {filePath.map((item, index) => {
            const isLast = index === filePath.length - 1;

            return (
              <React.Fragment key={item._id}>
                <BreadcrumbItem className="text-sm">
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center gap-1">
                      <FileIcon
                        fileName={item.name}
                        autoAssign
                        className="size-4"
                      />
                      <span className="truncate">{item.name}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="" href="#">
                      <span className="truncate">{item.name}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
