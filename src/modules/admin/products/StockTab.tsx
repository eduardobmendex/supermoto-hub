import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { invalidateProduct, productInventoryQuery, type InventoryRow } from "../api";
import { Field } from "../fields";
import { errorMessage } from "../files";

export function StockTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery(productInventoryQuery(productId));
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  return <StockForm key={data?.id ?? "none"} productId={productId} row={data ?? null} />;
}

function StockForm({ productId, row }: { productId: string; row: InventoryRow | null }) {
  const qc = useQueryClient();
  const [tracked, setTracked] = useState(!!row);
  const [quantity, setQuantity] = useState(String(row?.quantity ?? 0));
  const [threshold, setThreshold] = useState(String(row?.low_stock_threshold ?? 0));
  const [busy, setBusy] = useState(false);
  const qty = Number(quantity);

  const save = async () => {
    setBusy(true);
    try {
      if (!tracked) {
        if (row) {
          if (
            !confirm(
              "Parar de controlar o estoque por quantidade? A disponibilidade volta a ser definida manualmente na aba Dados.",
            )
          ) {
            setBusy(false);
            return;
          }
          const { error } = await supabase.from("inventory").delete().eq("id", row.id);
          if (error) throw error;
        }
      } else {
        const low = Number(threshold);
        if (!Number.isInteger(qty) || qty < 0)
          throw new Error("A quantidade deve ser um número inteiro, zero ou maior.");
        if (!Number.isInteger(low) || low < 0)
          throw new Error("O alerta de estoque baixo deve ser zero ou maior.");
        const { error } = row
          ? await supabase
              .from("inventory")
              .update({ quantity: qty, low_stock_threshold: low })
              .eq("id", row.id)
          : await supabase
              .from("inventory")
              .insert({ product_id: productId, quantity: qty, low_stock_threshold: low });
        if (error) throw error;
      }
      toast.success("Estoque salvo.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setBusy(false);
    invalidateProduct(qc, productId);
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={tracked}
          onCheckedChange={setTracked}
          aria-label="Controlar estoque por quantidade"
        />{" "}
        Controlar estoque por quantidade
      </label>
      {tracked ? (
        <>
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <Field label="Quantidade em estoque">
              <Input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="Avisar quando restar até" hint="Só para a sua referência.">
              <Input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">
            A loja mostra apenas <strong>Disponível</strong> ou <strong>Indisponível</strong>, nunca
            a quantidade. Com quantidade{" "}
            {Number.isInteger(qty) && qty > 0 ? "maior que zero" : "zero"}, o produto aparece como{" "}
            <strong>{Number.isInteger(qty) && qty > 0 ? "disponível" : "indisponível"}</strong>.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem controle por quantidade, a disponibilidade é escolhida manualmente na aba Dados.
        </p>
      )}
      <Button type="button" disabled={busy} onClick={() => void save()}>
        Salvar estoque
      </Button>
    </div>
  );
}
