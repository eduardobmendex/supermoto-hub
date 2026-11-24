import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, slugify, uploadFile, type Category } from "@/lib/store";
import { sectorByKey } from "@/modules/catalog/sectors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "./files";

/** Categories are the store sectors: the slug of each one is the key the storefront filters by. */
export function CategoriesAdmin() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [name, setName] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
  };

  const add = async () => {
    const clean = name.trim();
    if (!clean) return;
    const { error } = await supabase
      .from("categories")
      .insert({ name: clean, slug: slugify(clean), sort_order: cats.length + 1 });
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setName("");
    refresh();
  };
  const update = async (id: string, patch: Partial<Category>) => {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) toast.error(errorMessage(error));
    refresh();
  };
  const move = async (i: number, d: number) => {
    const a = cats[i];
    const b = cats[i + d];
    if (!a || !b) return;
    await supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id);
    refresh();
  };
  const remove = async (c: Category) => {
    if (!confirm(`Excluir "${c.name}"? Os produtos deste setor ficam sem setor.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  };

  return (
    <div className="mt-6 max-w-3xl">
      <h2 className="mb-1 text-2xl font-bold uppercase">Setores</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Os 9 setores da loja são categorias. O endereço (slug) de cada um é o que o site usa para
        filtrar: não o altere nos setores oficiais.
      </p>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          placeholder="Novo setor"
          aria-label="Nome do novo setor"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit">
          <Plus /> Adicionar
        </Button>
      </form>
      <div className="divide-y rounded-lg border bg-card">
        {cats.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 p-3">
            <label
              className="size-12 shrink-0 cursor-pointer overflow-hidden rounded border bg-stage"
              title="Imagem"
            >
              {c.image_url ? (
                <img src={c.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Upload className="m-auto mt-3 size-5 text-muted-foreground" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) void update(c.id, { image_url: await uploadFile(file, "categories") });
                }}
              />
            </label>
            <div className="min-w-0 flex-1">
              <Input
                defaultValue={c.name}
                aria-label={`Nome de ${c.name}`}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== c.name &&
                  void update(c.id, { name: e.target.value.trim() })
                }
              />
              <p className="tech mt-1 flex items-center gap-2 text-muted-foreground">
                {c.slug}
                {sectorByKey(c.slug) && <Badge variant="secondary">setor oficial</Badge>}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Subir"
              onClick={() => void move(i, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Descer"
              onClick={() => void move(i, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Excluir ${c.name}`}
              onClick={() => void remove(c)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
