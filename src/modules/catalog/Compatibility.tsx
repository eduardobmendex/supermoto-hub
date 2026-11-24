import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { fitmentsQuery, groupFitments } from "./catalog";

export function Compatibility({ productId }: { productId: string }) {
  const { data, isLoading, isError } = useQuery(fitmentsQuery(productId));
  if (isLoading) return null;
  const groups = groupFitments(data ?? []);

  return (
    <section className="mt-8 border p-4" aria-labelledby="compat-title">
      <h2 id="compat-title" className="tech flex items-center gap-2 text-muted-foreground">
        {groups.length ? (
          <ShieldCheck className="size-4 text-success" />
        ) : (
          <ShieldQuestion className="size-4" />
        )}
        Compatibilidade
      </h2>
      {groups.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {groups.map((g) => (
            <li key={`${g.label}-${g.position}-${g.restrictions}-${g.notes}`}>
              <span className="font-medium">{g.label}</span>
              <span className="text-muted-foreground"> · {g.years.join(", ")}</span>
              {(g.position || g.restrictions) && (
                <span className="tech ml-2 text-muted-foreground">
                  {[g.position, g.restrictions].filter(Boolean).join(" · ")}
                </span>
              )}
              {g.notes && <p className="text-xs text-muted-foreground">{g.notes}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {isError
            ? "Não foi possível carregar a compatibilidade agora."
            : "Compatibilidade ainda não confirmada para este produto. Antes de comprar, fale com a gente pelo WhatsApp informando a sua moto."}
        </p>
      )}
    </section>
  );
}
