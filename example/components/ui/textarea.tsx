import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-none rounded-lg border border-white/12 bg-stone-950/70 px-3 py-3 text-sm leading-6 text-stone-100 shadow-inner outline-none transition",
        "placeholder:text-stone-500 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-400/15",
        className,
      )}
      {...props}
    />
  );
}
