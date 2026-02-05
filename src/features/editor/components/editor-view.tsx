import Image from "next/image";
import { useFile, useUpdateFile } from "@/features/projects/hooks/use-files";
import { Id } from "../../../../convex/_generated/dataModel";
import { useEditor } from "../hooks/use-editor";
import { CodeEditor } from "./code-editor";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { TopNavigation } from "./top-navigation";
import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 1500;

export const EditorView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const { activeTabId } = useEditor(projectId);
  const activeFile = useFile(activeTabId);
  const updateFile = useUpdateFile();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [activeTabId]);

  const isActiveFileBinary = activeFile && activeFile.storageId;
  const isActiveFileText = activeFile && !activeFile.storageId;

  const debouncedUpdateFile = (content: string) => {
    if (!activeFile) return;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      updateFile({ id: activeFile._id, content });
    }, DEBOUNCE_MS);
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center">
        <TopNavigation projectId={projectId} />
      </div>
      {activeTabId && <FileBreadcrumbs projectId={projectId} />}
      <div className="bg-background min-h-0 flex-1">
        {!activeFile && (
          <div className="flex size-full items-center justify-center">
            <Image
              src="/logo-alt.svg"
              alt="Logo"
              width={50}
              height={50}
              className="opacity-25"
            />
          </div>
        )}

        {isActiveFileText && (
          <CodeEditor
            key={activeFile._id}
            fileName={activeFile.name}
            initialValue={activeFile.content}
            onChange={debouncedUpdateFile}
          />
        )}

        {isActiveFileBinary && <p>TODO: Implement Binary Preview</p>}
      </div>
    </div>
  );
};
