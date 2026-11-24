import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ProductGrid } from "@/components/ProductCard";
import { SiteLayout } from "@/components/SiteLayout";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  brandsWithProductsQuery,
  catalogQuery,
  catalogSearchSchema,
  SORTS,
  type CatalogSearch,
  type SortKey,
} from "@/modules/catalog/catalog";
import { SECTORS, sectorByKey } from "@/modules/catalog/sectors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalogo")({
  validateSearch: catalogSearchSchema,
  head: () => ({
    meta: [
      { title: "Catálogo — APEX" },
      {
        name: "description",
        content:
          "Peças e acessórios para motocicletas, filtrados por setor, disponibilidade e preço.",
      },
      { property: "og:title", content: "Catálogo — APEX" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CatalogPage,
});

const chip = "tech shrink-0 border px-3 py-2 transition-colors";

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/catalogo" });
  const { data, isLoading, isError, isPlaceholderData } = useQuery(catalogQuery(search));
  const { data: brands = [] } = useQuery(brandsWithProductsQuery);
  const sector = sectorByKey(search.setor);
  const [term, setTerm] = useState(search.q ?? "");
  useEffect(() => setTerm(search.q ?? ""), [search.q]);

  // Any change to a filter goes back to the first page.
  const update = (patch: Partial<CatalogSearch>) =>
    navigate({ search: (prev) => ({ ...prev, pagina: undefined, ...patch }) });
  const page = search.pagina ?? 1;
  // A page number beyond the last one (an old link, a typed URL) lands on the last page instead of an empty list.
  useEffect(() => {
    if (data && data.total > 0 && search.pagina && search.pagina > data.pages) {
      navigate({
        search: (prev) => ({ ...prev, pagina: data.pages > 1 ? data.pages : undefined }),
        replace: true,
      });
    }
  }, [data, search.pagina, navigate]);
  const goTo = (p: number) => {
    navigate({ search: (prev) => ({ ...prev, pagina: p > 1 ? p : undefined }) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 pt-12">
        <p className="eyebrow">{sector ? `Setor ${sector.code}` : "Catálogo"}</p>
        <h1 className="mt-2 text-5xl font-extrabold uppercase md:text-7xl">
          {sector?.name ?? "Todas as peças"}
        </h1>
        {sector && <p className="mt-3 max-w-xl text-muted-foreground">{sector.description}</p>}

        <div
          className="mt-8 flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible"
          role="group"
          aria-label="Setores"
        >
          <button
            type="button"
            onClick={() => update({ setor: undefined })}
            aria-pressed={!search.setor}
            className={cn(
              chip,
              !search.setor
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            Todos
          </button>
          {SECTORS.map((s) => (
            <button
              type="button"
              key={s.key}
              onClick={() => update({ setor: s.key })}
              aria-pressed={search.setor === s.key}
              className={cn(
                chip,
                search.setor === s.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-y py-4">
          <form
            role="search"
            className="relative min-w-52 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: term.trim() || undefined });
            }}
          >
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar peça, marca ou descrição…"
              aria-label="Buscar no catálogo"
              className="pl-9"
            />
          </form>
          <label className="tech flex items-center gap-2 text-muted-foreground">
            <Switch
              checked={!!search.disponiveis}
              onCheckedChange={(v) => update({ disponiveis: v || undefined })}
            />{" "}
            Só disponíveis
          </label>
          {/* Only brands with published products are offered, and only once there is one. */}
          {(brands.length > 0 || search.marca) && (
            <label className="tech flex items-center gap-2 text-muted-foreground">
              Marca
              <select
                value={search.marca ?? ""}
                onChange={(e) => update({ marca: e.target.value || undefined })}
                className="h-9 rounded-none border bg-background px-2 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">Todas</option>
                {brands.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="tech flex items-center gap-2 text-muted-foreground">
            Ordenar
            <select
              value={search.ordem ?? "recentes"}
              onChange={(e) =>
                update({
                  ordem: e.target.value === "recentes" ? undefined : (e.target.value as SortKey),
                })
              }
              className="h-9 rounded-none border bg-background px-2 text-sm normal-case tracking-normal text-foreground"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="tech mt-4 text-muted-foreground" aria-live="polite">
          {data ? `${data.total} ${data.total === 1 ? "produto" : "produtos"}` : " "}
        </p>

        <div className={cn("mt-6 transition-opacity", isPlaceholderData && "opacity-50")}>
          {isError ? (
            <p className="border p-8 text-center text-muted-foreground">
              Não foi possível carregar o catálogo. Tente novamente em instantes.
            </p>
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse bg-card" />
              ))}
            </div>
          ) : data && data.items.length ? (
            <ProductGrid items={data.items} />
          ) : (
            <div className="bg-carbon border p-12 text-center">
              <h2 className="text-2xl font-bold uppercase">Nenhuma peça encontrada</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                {data?.sectorMissing || (sector && !search.q)
                  ? "Este setor ainda não tem produtos publicados."
                  : "Tente outros termos ou remova algum filtro."}
              </p>
              <Link to="/catalogo" className="tech mt-5 inline-block text-primary hover:underline">
                Limpar filtros
              </Link>
            </div>
          )}
        </div>

        {data && data.pages > 1 && (
          <nav aria-label="Paginação" className="mt-10 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
              className="flex size-10 items-center justify-center border hover:border-primary disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <span className="tech text-muted-foreground">
              Página {page} de {data.pages}
            </span>
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              disabled={page >= data.pages}
              aria-label="Próxima página"
              className="flex size-10 items-center justify-center border hover:border-primary disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
          </nav>
        )}
      </div>
    </SiteLayout>
  );
}
