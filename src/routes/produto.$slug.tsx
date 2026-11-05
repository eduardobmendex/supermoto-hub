import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Check, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductStage } from "@/components/ProductStage";
import { ProductGrid } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { categoriesQuery, formatBRL, productQuery, productsQuery, settingsQuery, whatsappLink, type Spec } from "@/lib/store";

export const Route = createFileRoute("/produto/$slug")({
  head: () => ({
    meta: [
      { title: "Produto — SuperMotos" },
      { name: "description", content: "Veja o produto em 3D e compre pelo WhatsApp na SuperMotos." },
      { property: "og:title", content: "Produto — SuperMotos" },
      { property: "og:description", content: "Veja o produto em 3D e compre pelo WhatsApp." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p, isLoading } = useQuery(productQuery(slug));
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: all = [] } = useQuery(productsQuery);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  if (isLoading) return <SiteLayout><div className="mx-auto max-w-7xl px-4 py-24 text-muted-foreground">Carregando…</div></SiteLayout>;
  if (!p) return <SiteLayout><div className="mx-auto max-w-7xl px-4 py-24"><h1 className="text-3xl font-bold">Produto não encontrado</h1><Link to="/" className="text-primary">Voltar</Link></div></SiteLayout>;

  const cat = cats.find((c) => c.id === p.category_id);
  const specs = (p.specs as Spec[]) ?? [];
  const inStock = p.stock_status === "in_stock";
  const buy = () => {
    const extra = [size && `Tamanho: ${size}`, color && `Cor: ${color}`].filter(Boolean).join(" · ");
    const url = whatsappLink(s?.whatsapp ?? "", { name: extra ? `${p.name} (${extra})` : p.name, price: Number(p.price) }, window.location.href);
    window.open(url, "_blank", "noopener");
  };

  return (
    <SiteLayout>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 lg:grid-cols-[1.3fr_1fr]">
        <ProductStage product={p} />
        <div>
          <p className="eyebrow">{cat?.name} · {p.brand}</p>
          <h1 className="mt-2 text-3xl font-bold uppercase md:text-4xl">{p.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-primary">{formatBRL(Number(p.price))}</span>
            {p.old_price && <span className="text-muted-foreground line-through">{formatBRL(Number(p.old_price))}</span>}
          </div>
          <p className={`mt-2 flex items-center gap-1 text-sm ${inStock ? "text-success" : "text-destructive"}`}>
            {inStock ? <Check className="size-4" /> : <X className="size-4" />}{inStock ? "Disponível" : "Indisponível no momento"}
          </p>
          {p.sizes.length > 0 && <Options label="Tamanho" items={p.sizes} value={size} onChange={setSize} />}
          {p.colors.length > 0 && <Options label="Cor" items={p.colors} value={color} onChange={setColor} />}
          <Button size="lg" onClick={buy} className="mt-8 w-full bg-whatsapp font-display text-base uppercase text-whatsapp-foreground hover:bg-whatsapp/90">
            <MessageCircle /> Comprar pelo WhatsApp
          </Button>
          <p className="mt-8 whitespace-pre-line leading-relaxed text-muted-foreground">{p.description}</p>
          {specs.length > 0 && (
            <dl className="mt-8 divide-y rounded-lg border">
              {specs.map((sp) => (
                <div key={sp.label} className="flex justify-between gap-4 px-4 py-3 text-sm"><dt className="text-muted-foreground">{sp.label}</dt><dd className="text-right font-medium">{sp.value}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <section className="mx-auto max-w-7xl px-4 pt-20">
        <h2 className="mb-8 text-2xl font-bold uppercase">Relacionados</h2>
        <ProductGrid items={all.filter((x) => x.active && x.id !== p.id && x.category_id === p.category_id).slice(0, 4)} />
      </section>
    </SiteLayout>
  );
}

function Options({ label, items, value, onChange }: { label: string; items: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button key={i} onClick={() => onChange(i)} className={`min-w-12 rounded-md border px-3 py-2 text-sm transition ${value === i ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>{i}</button>
        ))}
      </div>
    </div>
  );
}
