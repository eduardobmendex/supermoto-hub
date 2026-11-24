import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import heroImg from "@/assets/hero-helmet.jpg";
import { Reveal } from "@/components/brand/Reveal";
import { ProductGrid } from "@/components/ProductCard";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { catalogSizeQuery, railQuery } from "@/modules/catalog/catalog";
import { SECTORS } from "@/modules/catalog/sectors";
import { settingsQuery } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "APEX — Motorcycle Parts Experience" },
      {
        name: "description",
        content:
          "Peças e acessórios para motocicletas Honda, Yamaha e Suzuki, organizados por sistema: motor, freios, suspensão, rodas, transmissão e mais.",
      },
      { property: "og:title", content: "APEX — Motorcycle Parts Experience" },
      {
        property: "og:description",
        content: "Peças e acessórios para motocicletas, organizados por sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function SectionHead({ code, title, to }: { code: string; title: string; to?: boolean }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b pb-4">
      <div>
        <p className="eyebrow">{code}</p>
        <h2 className="mt-2 text-3xl font-bold uppercase md:text-5xl">{title}</h2>
      </div>
      {to && (
        <Link
          to="/catalogo"
          className="tech hidden items-center gap-1 text-muted-foreground hover:text-primary md:flex"
        >
          Ver catálogo <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function Rail({ code, title, rail }: { code: string; title: string; rail: "featured" | "new" }) {
  const { data = [] } = useQuery(railQuery(rail));
  // A rail with nothing in it is simply left out: no empty headings in front of customers.
  if (!data.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-24">
      <Reveal>
        <SectionHead code={code} title={title} to />
        <ProductGrid items={data} />
      </Reveal>
    </section>
  );
}

function Home() {
  const { data: s } = useQuery(settingsQuery);
  const { data: size } = useQuery(catalogSizeQuery);

  return (
    <SiteLayout>
      <section className="relative isolate overflow-hidden border-b">
        {/* Temporary art: swap it in the admin (Configurações → Imagem do banner). */}
        <img
          src={s?.banner_image || heroImg}
          alt=""
          width={1920}
          height={1088}
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[78%_center] grayscale contrast-125 md:object-right"
        />
        <div className="absolute inset-0 -z-10 bg-hero-fade" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="relative mx-auto flex min-h-[78svh] max-w-7xl flex-col justify-center px-4 py-24 md:min-h-[86vh]">
          <p className="eyebrow animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none">
            APEX / Motorcycle Parts Experience
          </p>
          <h1 className="mt-5 max-w-3xl text-6xl font-extrabold uppercase leading-[0.88] md:text-8xl animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
            Peças com engenharia <span className="whitespace-nowrap text-primary">de pista.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg text-muted-foreground">
            Motor, freios, suspensão e mais, organizados por sistema. Foco inicial em Honda, Yamaha
            e Suzuki.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="clip-corner h-12 px-7 font-display text-base font-bold uppercase tracking-wider shadow-glow"
            >
              <Link to="/catalogo">
                Explorar catálogo <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-7 font-display text-base font-bold uppercase tracking-wider"
            >
              <a href="#setores">Ver setores</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="setores" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-24">
        <Reveal>
          <SectionHead code="Sistemas" title="Encontre por setor" />
        </Reveal>
        {/* One reveal for the whole grid: its hairline background must not show up before the cards do. */}
        <Reveal>
          <div className="grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {SECTORS.map((sector) => (
              <Link
                key={sector.key}
                to="/catalogo"
                search={{ setor: sector.key }}
                className="group relative flex h-full min-h-44 flex-col justify-between gap-6 overflow-hidden bg-card p-5 sm:min-h-56 sm:p-6 transition-colors hover:bg-secondary"
              >
                <span
                  aria-hidden
                  className="absolute -right-2 -top-6 font-display text-9xl font-extrabold italic text-foreground/[0.04] transition-colors group-hover:text-primary/15"
                >
                  {sector.code}
                </span>
                <div className="flex items-start justify-between">
                  <sector.icon className="size-8 text-primary" strokeWidth={1.5} />
                  <ArrowUpRight className="size-5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div>
                  <p className="tech text-muted-foreground">
                    {sector.code} / {sector.scope}
                  </p>
                  <h3 className="mt-2 text-3xl font-bold uppercase">{sector.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{sector.description}</p>
                </div>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100 motion-reduce:transition-none"
                />
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      <Rail code="Seleção" title="Produtos em destaque" rail="featured" />
      <Rail code="Acabou de chegar" title="Novidades" rail="new" />

      {size === 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24">
          <div className="bg-carbon border p-10 text-center">
            <p className="eyebrow">Catálogo</p>
            <h2 className="mt-3 text-3xl font-bold uppercase md:text-4xl">
              Estamos montando o catálogo
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              As primeiras peças chegam em breve. Fale com a gente pelo WhatsApp para consultar
              disponibilidade.
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-24">
        <Reveal>
          <SectionHead code="Método" title="Peça certa, sem achismo" />
          <div className="grid gap-px border bg-border md:grid-cols-3">
            {[
              [
                "01",
                "Por sistema",
                "O catálogo segue a anatomia da moto: você chega à peça pelo sistema a que ela pertence.",
              ],
              [
                "02",
                "Compatibilidade validada",
                "Só afirmamos que uma peça serve na sua moto quando a aplicação está cadastrada e conferida.",
              ],
              [
                "03",
                "Detalhe antes de comprar",
                "Fotos ampliáveis em tela cheia para inspecionar acabamento e dimensões antes do pedido.",
              ],
            ].map(([n, t, d]) => (
              <div key={n} className="bg-card p-6">
                <p className="tech text-primary">{n}</p>
                <h3 className="mt-3 text-2xl font-bold uppercase">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
