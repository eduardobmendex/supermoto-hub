import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Instagram, MapPin, Clock, Search, MessageCircle, Menu, X } from "lucide-react";
import { categoriesQuery, settingsQuery } from "@/lib/store";
import { Input } from "@/components/ui/input";

export function SiteLayout({ children }: { children: ReactNode }) {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wa = `https://wa.me/${(s?.whatsapp ?? "").replace(/\D/g, "")}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
          <Link to="/" className="flex items-center gap-2">
            {s?.logo_url ? <img src={s.logo_url} alt={s.store_name} className="h-8" /> : (
              <span className="font-display text-xl font-bold uppercase italic tracking-tight">Super<span className="text-primary">Motos</span></span>
            )}
          </Link>
          <form className="relative ml-auto hidden max-w-sm flex-1 md:block" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/busca", search: { q } }); }}>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar capacetes, luvas, peças…" className="pl-9" />
          </form>
          <a href={wa} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-2 rounded-md bg-whatsapp px-3 py-2 text-sm font-semibold text-whatsapp-foreground md:ml-0">
            <MessageCircle className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
        <nav className={`${open ? "block" : "hidden"} border-t md:block`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-1 overflow-x-auto px-4 py-2 md:flex-row md:gap-6">
            {cats.map((c) => (
              <Link key={c.id} to="/categoria/$slug" params={{ slug: c.slug }} onClick={() => setOpen(false)} className="whitespace-nowrap py-1 font-display text-sm uppercase tracking-wider text-muted-foreground hover:text-primary" activeProps={{ className: "text-primary" }}>
                {c.name}
              </Link>
            ))}
          </div>
          <form className="relative px-4 pb-3 md:hidden" onSubmit={(e) => { e.preventDefault(); setOpen(false); navigate({ to: "/busca", search: { q } }); }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos…" />
          </form>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-3">
          <div>
            <span className="font-display text-2xl font-bold uppercase italic">Super<span className="text-primary">Motos</span></span>
            <p className="mt-3 text-sm text-muted-foreground">Equipamentos, acessórios e peças para motociclistas exigentes.</p>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="flex gap-2"><MapPin className="size-4 shrink-0 text-primary" />{s?.address}</p>
            <p className="flex gap-2"><Clock className="size-4 shrink-0 text-primary" />{s?.hours}</p>
          </div>
          <div className="space-y-3 text-sm">
            <a href={wa} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-primary"><MessageCircle className="size-4 text-primary" /> WhatsApp</a>
            {s?.instagram && <a href={`https://instagram.com/${s.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-primary"><Instagram className="size-4 text-primary" /> @{s.instagram.replace("@", "")}</a>}
            <Link to="/admin" className="block text-xs text-muted-foreground hover:text-primary">Área da loja</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
