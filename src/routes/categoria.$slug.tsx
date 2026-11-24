import { createFileRoute, redirect } from "@tanstack/react-router";

// Old category URL: a category slug is now a sector key in the catalog.
export const Route = createFileRoute("/categoria/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/catalogo", search: { setor: params.slug }, replace: true });
  },
});
