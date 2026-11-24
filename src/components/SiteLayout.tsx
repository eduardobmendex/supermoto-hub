import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Instagram, MapPin, Clock, Search, MessageCircle, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Input } from "@/components/ui/input";
import { SECTORS } from "@/modules/catalog/sectors";
import { settingsQuery } from "@/lib/store";

export function SiteLayout({ children }: { children: ReactNode }) {
  const { data: s } = useQuery(settingsQuery);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wa = `https://wa.me/${(s?.whatsapp ?? "").replace(/\D/g, "")}`;
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate({ to: "/catalogo", search: { q: q.trim() || undefined } });
  };

  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <button
            type="button"
            className="-ml-2 flex size-11 items-center justify-center md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
          <Link to="/" aria-label="APEX, página inicial">
            <Wordmark />
          </Link>
          <Link
            to="/catalogo"
            className="ml-4 hidden font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground md:block"
            activeProps={{ className: "text-foreground" }}
          >
            Catálogo
          </Link>
          <form
            role="search"
            className="relative ml-auto hidden max-w-sm flex-1 md:block"
            onSubmit={search}
          >
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar peça, marca ou código…"
              aria-label="Buscar no catálogo"
              className="pl-9"
            />
          </form>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-2 bg-whatsapp px-3 py-2 text-sm font-semibold text-whatsapp-foreground md:ml-0"
          >
            <MessageCircle className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
        <nav aria-label="Setores" className={`${open ? "block" : "hidden"} border-t md:block`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-1 overflow-x-auto px-4 py-2 md:flex-row md:justify-between md:gap-5">
            <Link
              to="/catalogo"
              onClick={() => setOpen(false)}
              className="py-1 font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-primary md:hidden"
            >
              Catálogo completo
            </Link>
            {SECTORS.map((sector) => (
              <Link
                key={sector.key}
                to="/catalogo"
                search={{ setor: sector.key }}
                onClick={() => setOpen(false)}
                className="whitespace-nowrap py-1 font-display text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-primary"
              >
                {sector.name}
              </Link>
            ))}
          </div>
          <form role="search" className="px-4 pb-3 md:hidden" onSubmit={search}>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar peça, marca ou código…"
              aria-label="Buscar no catálogo"
            />
          </form>
        </nav>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="mt-24 border-t bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-3">
          <div>
            <Wordmark size="lg" />
            <p className="tech mt-4 text-muted-foreground">Motorcycle Parts Experience</p>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Peças e acessórios para motocicletas, organizados por sistema.
            </p>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            {s?.address && (
              <p className="flex gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                {s.address}
              </p>
            )}
            {s?.hours && (
              <p className="flex gap-2">
                <Clock className="size-4 shrink-0 text-primary" />
                {s.hours}
              </p>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <a href={wa} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-primary">
              <MessageCircle className="size-4 text-primary" /> WhatsApp
            </a>
            {s?.instagram && (
              <a
                href={`https://instagram.com/${s.instagram.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 hover:text-primary"
              >
                <Instagram className="size-4 text-primary" /> @{s.instagram.replace("@", "")}
              </a>
            )}
            <Link to="/admin" className="tech block text-muted-foreground hover:text-primary">
              Área da loja
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
