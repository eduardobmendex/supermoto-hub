import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductGrid } from "@/components/ProductCard";
import { productsQuery } from "@/lib/store";

export const Route = createFileRoute("/busca")({
  validateSearch: z.object({ q: z.string().catch("") }),
  head: () => ({
    meta: [
      { title: "Buscar produtos — SuperMotos" },
      { name: "description", content: "Encontre capacetes, luvas, jaquetas, botas e peças na SuperMotos." },
      { property: "og:title", content: "Buscar produtos — SuperMotos" },
      { property: "og:description", content: "Encontre equipamentos para motociclistas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data: products = [] } = useQuery(productsQuery);
  const t = q.toLowerCase().trim();
  const items = products.filter((p) => p.active && (!t || `${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(t)));
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 pt-12">
        <p className="eyebrow">Busca</p>
        <h1 className="mb-10 mt-2 text-3xl font-bold uppercase md:text-4xl">{t ? `Resultados para “${q}”` : "Todos os produtos"}</h1>
        <ProductGrid items={items} />
      </div>
    </SiteLayout>
  );
}
