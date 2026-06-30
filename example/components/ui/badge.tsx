import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  readonly tone?: "neutral" | "success" | "danger" | "warning";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "border-white/12 bg-white/[0.06] text-stone-300",
        tone === "success" && "border-emerald-300/25 bg-emerald-400/12 text-emerald-100",
        tone === "danger" && "border-rose-300/25 bg-rose-400/12 text-rose-100",
        tone === "warning" && "border-amber-300/25 bg-amber-400/12 text-amber-100",
        className,
      )}
      {...props}
    />
  );
}
