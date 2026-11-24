import type { ReactNode } from "react";

export const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";

/**
 * A labelled form field. Wrapping the control in <label> ties the text to it, so screen readers
 * announce it and clicking the text focuses the control. The hint stays outside the label so the
 * accessible name remains short.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium leading-none">{label}</span>
        {children}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{children}</p>
  );
}
