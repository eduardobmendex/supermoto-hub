import { cn } from "@/lib/utils";

/** APEX wordmark: an italic condensed logotype and a red chevron, the "apex" of a corner. */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display font-extrabold italic uppercase leading-none tracking-tight text-foreground",
        size === "lg" ? "text-4xl" : "text-2xl",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={cn("text-primary", size === "lg" ? "size-8" : "size-6")}
      >
        <path d="M2 21 12 3l10 18h-6.2L12 11.2 8.2 21z" fill="currentColor" />
      </svg>
      <span>APEX</span>
    </span>
  );
}
