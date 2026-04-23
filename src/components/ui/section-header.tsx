import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="text-eyebrow text-primary">{eyebrow}</div>}
        <h1 className="text-[20px] md:text-2xl font-semibold tracking-tight mt-1.5 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}