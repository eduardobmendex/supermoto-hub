import { Link } from "@tanstack/react-router";
import { Box, ImageIcon } from "lucide-react";
import { formatBRL, type Product } from "@/lib/store";

export function ProductCard({ p }: { p: Product }) {
  const has3d = p.model_status === "ready" && p.model_approved;
  return (
    <Link to="/produto/$slug" params={{ slug: p.slug }} className="group block overflow-hidden rounded-lg border bg-card transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow">
      <div className="relative aspect-square bg-stage">
        {p.images[0] ? (
          <>
            <img src={p.images[0]} alt={p.name} loading="lazy" className={`h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105 ${p.images[1] ? "group-hover:opacity-0" : ""}`} />
            {p.images[1] && <img src={p.images[1]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-4 opacity-0 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="size-10" /></div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {p.is_new && <span className="rounded bg-primary px-2 py-0.5 font-display text-[10px] uppercase text-primary-foreground">Novo</span>}
          {p.old_price && <span className="rounded bg-foreground px-2 py-0.5 font-display text-[10px] uppercase text-background">Oferta</span>}
        </div>
        {has3d && <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-background/80 px-2 py-0.5 font-display text-[10px] uppercase text-primary"><Box className="size-3" />3D</span>}
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.brand}</p>
        <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold">{p.name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-primary">{formatBRL(Number(p.price))}</span>
          {p.old_price && <span className="text-xs text-muted-foreground line-through">{formatBRL(Number(p.old_price))}</span>}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  if (!items.length) return <p className="text-muted-foreground">Nenhum produto encontrado.</p>;
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}
