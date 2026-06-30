import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: "primary" | "secondary" | "ghost" | "danger";
  readonly size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "border-emerald-400 bg-emerald-300 text-emerald-950 shadow-[0_12px_28px_rgba(16,185,129,0.2)] hover:bg-emerald-200",
        variant === "secondary" &&
          "border-white/12 bg-white/[0.07] text-stone-100 hover:bg-white/[0.11]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-stone-300 hover:bg-white/[0.08]",
        variant === "danger" &&
          "border-rose-400/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/20",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-10 w-10",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
