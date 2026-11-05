import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductGrid } from "@/components/ProductCard";
import { categoriesQuery, productsQuery } from "@/lib/store";

export const Route = createFileRoute("/categoria/$slug")({
  head: () => ({
    meta: [
      { title: "Categoria — SuperMotos" },
      { name: "description", content: "Produtos para motociclistas por categoria na SuperMotos." },
      { property: "og:title", content: "Categoria — SuperMotos" },
      { property: "og:description", content: "Produtos para motociclistas por categoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const cat = cats.find((c) => c.slug === slug);
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 pt-12">
        <p className="eyebrow">Categoria</p>
        <h1 className="mb-10 mt-2 text-4xl font-bold uppercase md:text-5xl">{cat?.name ?? "…"}</h1>
        <ProductGrid items={products.filter((p) => p.active && p.category_id === cat?.id)} />
      </div>
    </SiteLayout>
  );
}
