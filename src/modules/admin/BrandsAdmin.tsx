import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND_KINDS, brandsAdminQuery, motorcyclesAdminQuery } from "./api";
import { errorMessage } from "./files";
import { EmptyNote, selectClass } from "./fields";

type Kind = keyof typeof BRAND_KINDS;

export function BrandsAdmin() {
  const qc = useQueryClient();
  const { data: brands = [], isLoading } = useQuery(brandsAdminQuery);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("part");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "brands"] });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["admin", "motorcycles"] });
  };

  const add = async () => {
    const clean = name.trim();
    if (!clean) {
      toast.error("Informe o nome da marca.");
      return;
    }
    const slug = slugify(clean);
    if (!slug) {
      toast.error("O nome precisa ter letras ou números.");
      return;
    }
    const { error } = await supabase.from("brands").insert({ name: clean, slug, kind });
    if (error) {
      toast.error(
        /duplicate key/i.test(error.message)
          ? "Já existe uma marca com este nome."
          : errorMessage(error),
      );
      return;
    }
    setName("");
    refresh();
    toast.success("Marca criada.");
  };

  const changeKind = async (id: string, next: Kind) => {
    const { error } = await supabase.from("brands").update({ kind: next }).eq("id", id);
    if (error) toast.error(errorMessage(error));
    refresh();
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Excluir a marca "${label}"? Produtos que a usam ficam sem marca.`)) return;
    // Marcas com motocicletas cadastradas não podem ser excluídas (restrição do banco).
    const motos = await qc.fetchQuery(motorcyclesAdminQuery);
    if (motos.some((m) => m.brand_id === id)) {
      toast.error(`"${label}" tem motocicletas cadastradas. Exclua-as primeiro.`);
      return;
    }
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  };

  return (
    <div className="mt-6 max-w-3xl">
      <h2 className="mb-1 text-2xl font-bold uppercase">Marcas</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Fabricantes de peças e de motocicletas. Só marcas de motocicletas aparecem ao cadastrar
        motos (Honda, Yamaha, Suzuki...).
      </p>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          className="min-w-48 flex-1"
          placeholder="Nome da marca"
          aria-label="Nome da marca"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className={cn(selectClass, "w-auto")}
          aria-label="Tipo da marca"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
        >
          {Object.entries(BRAND_KINDS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit">
          <Plus /> Adicionar
        </Button>
      </form>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : brands.length ? (
        <div className="divide-y rounded-lg border bg-card">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.name}</p>
                <p className="tech text-muted-foreground">{b.slug}</p>
              </div>
              <select
                className={cn(selectClass, "w-auto")}
                aria-label={`Tipo de ${b.name}`}
                value={b.kind}
                onChange={(e) => void changeKind(b.id, e.target.value as Kind)}
              >
                {Object.entries(BRAND_KINDS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Excluir ${b.name}`}
                onClick={() => void remove(b.id, b.name)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyNote>
          Nenhuma marca ainda. Comece cadastrando Honda, Yamaha e Suzuki como "Motocicletas".
        </EmptyNote>
      )}
    </div>
  );
}
