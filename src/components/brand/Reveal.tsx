import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades a block in as it scrolls into view. The animation is pure CSS (see `.reveal` in styles.css):
 * the content is visible by default, so server-rendered HTML, no-JavaScript visitors, browsers without
 * scroll-driven animations and people who prefer reduced motion all simply see the content.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("reveal", className)}>{children}</div>;
}
