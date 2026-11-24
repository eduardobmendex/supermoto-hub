import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Check, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductStage } from "@/components/ProductStage";
import { ProductGrid } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { relatedQuery } from "@/modules/catalog/catalog";
import { Compatibility } from "@/modules/catalog/Compatibility";
import { SECTORS } from "@/modules/catalog/sectors";
import {
  categoriesQuery,
  formatBRL,
  productQuery,
  settingsQuery,
  whatsappLink,
  type Spec,
} from "@/lib/store";

const FALLBACK_DESCRIPTION = "Detalhes, especificações e disponibilidade da peça na APEX.";

export const Route = createFileRoute("/produto/$slug")({
  // `{ product }` when the lookup worked (product may be null: it does not exist), `null` when it failed.
  // The page reuses it as the query's initial data, so the browser starts from exactly what the server
  // rendered (no "loading" flash and no hydration mismatch). A failure here never breaks the page.
  loader: async ({ context, params }) => {
    try {
      return { product: await context.queryClient.ensureQueryData(productQuery(params.slug)) };
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.name} — APEX` : "Produto — APEX";
    const description = p?.description?.trim()
      ? p.description.trim().replace(/\s+/g, " ").slice(0, 155)
      : FALLBACK_DESCRIPTION;
    const image = p?.images[0];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        // A demonstration product must never be indexed as if it were for sale.
        ...(p?.is_demo ? [{ name: "robots", content: "noindex" }] : []),
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const loaded = Route.useLoaderData();
  const { data: p, isLoading } = useQuery({
    ...productQuery(slug),
    ...(loaded ? { initialData: loaded.product } : {}),
  });
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: related = [] } = useQuery(
    p
      ? relatedQuery(p)
      : { queryKey: ["related", "none"], queryFn: async () => [], enabled: false },
  );
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  if (isLoading)
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-4 py-24 text-muted-foreground">Carregando…</div>
      </SiteLayout>
    );
  if (!p)
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-4 py-24">
          <h1 className="text-4xl font-bold uppercase">Produto não encontrado</h1>
          <Link to="/catalogo" className="tech mt-4 inline-block text-primary">
            Voltar ao catálogo
          </Link>
        </div>
      </SiteLayout>
    );

  const cat = cats.find((c) => c.id === p.category_id);
  const sector = SECTORS.find((x) => x.key === cat?.slug);
  const specs = (p.specs as Spec[]) ?? [];
  const inStock = p.stock_status === "in_stock";
  const buy = () => {
    const extra = [size && `Tamanho: ${size}`, color && `Cor: ${color}`]
      .filter(Boolean)
      .join(" · ");
    const url = whatsappLink(
      s?.whatsapp ?? "",
      { name: extra ? `${p.name} (${extra})` : p.name, price: Number(p.price) },
      window.location.href,
    );
    window.open(url, "_blank", "noopener");
  };

  return (
    <SiteLayout>
      <nav
        aria-label="Você está em"
        className="tech mx-auto max-w-7xl px-4 pt-6 text-muted-foreground"
      >
        <Link to="/catalogo" className="hover:text-primary">
          Catálogo
        </Link>
        {cat && (
          <>
            {" "}
            /{" "}
            <Link to="/catalogo" search={{ setor: cat.slug }} className="hover:text-primary">
              {sector?.name ?? cat.name}
            </Link>
          </>
        )}
      </nav>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <ProductStage product={p} />
        </div>
        <div>
          <p className="eyebrow">{p.brand || cat?.name}</p>
          <h1 className="mt-2 text-4xl font-extrabold uppercase leading-none md:text-6xl">
            {p.name}
          </h1>
          {p.sku && <p className="tech mt-3 text-muted-foreground">SKU {p.sku}</p>}
          {p.is_demo && (
            <p className="mt-4 border border-dashed p-3 text-sm text-muted-foreground">
              <span className="tech mr-2 text-primary">Demo</span>
              Produto de demonstração: não está à venda, e preço e dados são ilustrativos.
            </p>
          )}
          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-4xl font-bold">{formatBRL(Number(p.price))}</span>
            {p.old_price && (
              <span className="text-muted-foreground line-through">
                {formatBRL(Number(p.old_price))}
              </span>
            )}
          </div>
          <p
            className={`tech mt-3 flex items-center gap-1.5 ${inStock ? "text-success" : "text-destructive"}`}
          >
            {inStock ? <Check className="size-4" /> : <X className="size-4" />}
            {inStock ? "Disponível" : "Indisponível no momento"}
          </p>
          {p.sizes.length > 0 && (
            <Options label="Tamanho" items={p.sizes} value={size} onChange={setSize} />
          )}
          {p.colors.length > 0 && (
            <Options label="Cor" items={p.colors} value={color} onChange={setColor} />
          )}
          {!p.is_demo && (
            <Button
              size="lg"
              onClick={buy}
              className="clip-corner mt-8 h-12 w-full bg-whatsapp font-display text-base font-bold uppercase tracking-wider text-whatsapp-foreground hover:bg-whatsapp/90"
            >
              <MessageCircle /> Pedir pelo WhatsApp
            </Button>
          )}
          {p.description && (
            <p className="mt-8 whitespace-pre-line leading-relaxed text-muted-foreground">
              {p.description}
            </p>
          )}
          {specs.length > 0 && (
            <dl className="mt-8 divide-y border">
              {specs.map((sp) => (
                <div key={sp.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="tech self-center text-muted-foreground">{sp.label}</dt>
                  <dd className="text-right font-medium">{sp.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Compatibility productId={p.id} />
        </div>
      </div>
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24">
          <div className="mb-8 border-b pb-4">
            <p className="eyebrow">Mesmo setor</p>
            <h2 className="mt-2 text-3xl font-bold uppercase md:text-4xl">Produtos relacionados</h2>
          </div>
          <ProductGrid items={related} />
        </section>
      )}
    </SiteLayout>
  );
}

function Options({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-6" role="group" aria-label={label}>
      <p className="tech mb-2 text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            type="button"
            key={i}
            aria-pressed={value === i}
            onClick={() => onChange(i)}
            className={`min-w-12 border px-3 py-2 text-sm transition ${value === i ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground"}`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}
