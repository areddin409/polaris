import { useState } from "react";

import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { getItemPadding } from "./constants";

export const CreateInput = ({
  type,
  level,
  onSubmit,
  onCancel,
}: {
  type: "file" | "folder";
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="bg-accent/30 flex h-6 w-full items-center gap-1"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <div className="gap-.5 flex items-center">
        {type === "folder" && (
          <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
        )}

        {type === "file" && (
          <FileIcon fileName={value} autoAssign className="size-4" />
        )}

        {type === "folder" && (
          <FolderIcon folderName={value} className="size-4" />
        )}
      </div>
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSubmit}
        className="focus:ring-ring flex-1 bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }

          if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
    </div>
  );
};
