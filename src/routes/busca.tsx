import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Old search URL, kept so existing links keep working.
export const Route = createFileRoute("/busca")({
  validateSearch: z.object({ q: z.string().catch("") }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/catalogo", search: { q: search.q.trim() || undefined }, replace: true });
  },
});
