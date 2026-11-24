import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invalidateProduct, productSpecsQuery, type SpecRow } from "../api";
import { EmptyNote } from "../fields";
import { errorMessage } from "../files";

type Row = { id?: string; label: string; value: string };

export function SpecsTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery(productSpecsQuery(productId));
  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;
  // The form is built from the saved rows once; later edits stay local until saved.
  return <SpecsForm productId={productId} saved={data} />;
}

function SpecsForm({ productId, saved }: { productId: string; saved: SpecRow[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() =>
    saved.map((s) => ({ id: s.id, label: s.label, value: s.value })),
  );
  const [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<Row>) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const save = async () => {
    const filled = rows
      .map((r) => ({ ...r, label: r.label.trim(), value: r.value.trim() }))
      .filter((r) => r.label || r.value);
    if (filled.some((r) => !r.label || !r.value)) {
      toast.error("Preencha o nome e o valor de cada característica.");
      return;
    }
    const labels = filled.map((r) => r.label.toLowerCase());
    if (new Set(labels).size !== labels.length) {
      toast.error("Há características repetidas.");
      return;
    }
    setBusy(true);
    try {
      const keep = new Set(filled.flatMap((r) => (r.id ? [r.id] : [])));
      const removed = saved.filter((s) => !keep.has(s.id)).map((s) => s.id);
      if (removed.length) {
        const { error } = await supabase.from("product_specs").delete().in("id", removed);
        if (error) throw error;
      }
      for (const [index, r] of filled.entries()) {
        const { error } = r.id
          ? await supabase
              .from("product_specs")
              .update({ label: r.label, value: r.value, sort_order: index })
              .eq("id", r.id)
          : await supabase
              .from("product_specs")
              .insert({ product_id: productId, label: r.label, value: r.value, sort_order: index });
        if (error) throw error;
      }
      toast.success("Características salvas.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setBusy(false);
    invalidateProduct(qc, productId);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Dados técnicos exibidos na página do produto. Só informe valores conferidos: nada de medidas
        aproximadas.
      </p>
      {rows.length === 0 && <EmptyNote>Nenhuma característica ainda.</EmptyNote>}
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="flex gap-2">
          <Input
            placeholder="Ex.: Material"
            aria-label={`Nome da característica ${i + 1}`}
            value={r.label}
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <Input
            placeholder="Ex.: Aço forjado"
            aria-label={`Valor da característica ${i + 1}`}
            value={r.value}
            onChange={(e) => patch(i, { value: e.target.value })}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Remover característica ${i + 1}`}
            onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex justify-between">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRows((all) => [...all, { label: "", value: "" }])}
        >
          <Plus /> Adicionar
        </Button>
        <Button type="button" disabled={busy} onClick={() => void save()}>
          Salvar características
        </Button>
      </div>
    </div>
  );
}
