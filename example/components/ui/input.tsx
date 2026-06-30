import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-white/12 bg-stone-950/70 px-3 text-sm text-stone-100 shadow-inner outline-none transition",
        "placeholder:text-stone-500 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-400/15",
        className,
      )}
      {...props}
    />
  );
}
