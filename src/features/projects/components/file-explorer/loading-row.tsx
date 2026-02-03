import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

import { getItemPadding } from "./constants";

export const LoadingRow = ({
  className,
  level,
}: {
  className?: string;
  level?: number;
}) => {
  return (
    <div
      className={cn("text-muted-foreground flex h-6 items-center", className)}
      style={{ paddingLeft: getItemPadding(level ?? 0, true) }}
    >
      <Spinner className="text-ring ml-0.5 size-4" />
    </div>
  );
};
