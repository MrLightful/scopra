import type { ComponentType } from "react";
import { useMDXComponents as useThemeMDXComponents } from "nextra-theme-docs";

export function useMDXComponents(components: Record<string, ComponentType>) {
  return {
    ...useThemeMDXComponents(),
    ...components,
  };
}
