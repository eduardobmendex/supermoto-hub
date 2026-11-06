import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Hand, Maximize2, ZoomIn, Smartphone } from "lucide-react";
import heroImg from "@/assets/hero-helmet.jpg";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductGrid } from "@/components/ProductCard";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SuperMotos — Equipamentos para motociclistas" },
      { name: "description", content: "Capacetes, luvas, jaquetas, botas e peças. Veja cada detalhe e compre pelo WhatsApp." },
      { property: "og:title", content: "SuperMotos — Equipamentos para motociclistas" },
      { property: "og:description", content: "Veja cada detalhe dos produtos e compre pelo WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Section({ eyebrow, title, children, to }: { eyebrow: string; title: string; children: React.ReactNode; to?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-20">
      <div className="mb-8 flex items-end justify-between">
        <div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 text-3xl font-bold uppercase md:text-4xl">{title}</h2></div>
        {to && <Link to="/busca" search={{ q: "" }} className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-primary md:flex">Ver tudo <ArrowRight className="size-4" /></Link>}
      </div>
      {children}
    </section>
  );
}

function Home() {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const active = products.filter((p) => p.active);

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <img src={s?.banner_image || heroImg} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-center px-4 py-24">
          <p className="eyebrow animate-in fade-in slide-in-from-bottom-2 duration-700">Nova coleção</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold uppercase leading-[0.95] md:text-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">{s?.banner_title}</h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">{s?.banner_subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="font-display uppercase shadow-glow"><a href="#destaques">Ver destaques <ArrowRight /></a></Button>
            <Button asChild size="lg" variant="outline" className="font-display uppercase"><a href="#detalhes">Veja cada detalhe</a></Button>
          </div>
        </div>
      </section>

      <Section eyebrow="Explore" title="Categorias">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cats.map((c, i) => (
            <Link key={c.id} to="/categoria/$slug" params={{ slug: c.slug }} className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg border bg-card p-4 transition hover:border-primary">
              {c.image_url && <img src={c.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-50 transition group-hover:scale-105 group-hover:opacity-70" />}
              <span className="absolute right-3 top-2 font-display text-4xl font-bold text-muted/80">{String(i + 1).padStart(2, "0")}</span>
              <span className="relative font-display text-lg font-semibold uppercase group-hover:text-primary">{c.name}</span>
            </Link>
          ))}
        </div>
      </Section>

      <div id="destaques" />
      <Section eyebrow="Seleção" title="Produtos em destaque" to><ProductGrid items={active.filter((p) => p.featured).slice(0, 8)} /></Section>
      <Section eyebrow="Acabou de chegar" title="Lançamentos"><ProductGrid items={active.filter((p) => p.is_new).slice(0, 8)} /></Section>
      <Section eyebrow="Preço especial" title="Ofertas"><ProductGrid items={active.filter((p) => p.old_price).slice(0, 8)} /></Section>

      <section id="detalhes" className="mx-auto mt-24 max-w-7xl px-4">
        <div className="grid gap-10 rounded-xl border bg-stage p-8 md:grid-cols-2 md:p-14">
          <div>
            <p className="eyebrow">Experiência exclusiva</p>
            <h2 className="mt-3 text-3xl font-bold uppercase md:text-5xl">Veja cada detalhe de perto</h2>
            <p className="mt-4 text-muted-foreground">Passe o mouse sobre a foto para ampliar, abra em tela cheia e inspecione acabamentos e costuras antes de comprar — no computador ou no celular.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[[ZoomIn, "Zoom nos detalhes"], [Maximize2, "Tela cheia"], [Hand, "Pinça e deslize"], [Smartphone, "No celular e PC"]].map(([Icon, t]: any) => (
              <div key={t} className="rounded-lg border bg-background/60 p-5 backdrop-blur"><Icon className="size-7 text-primary" /><p className="mt-3 font-display font-semibold uppercase">{t}</p></div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
