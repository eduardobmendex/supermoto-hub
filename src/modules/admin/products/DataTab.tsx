import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, slugify, type Product } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { brandsAdminQuery, invalidateProduct } from "../api";
import { Field, selectClass } from "../fields";
import { errorMessage } from "../files";
import { commaList, formFromProduct, validateProductForm, type ProductForm } from "./validation";

export function DataTab({
  product,
  hasInventory,
  onSaved,
}: {
  product?: Product | undefined;
  hasInventory: boolean;
  onSaved: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: brands = [] } = useQuery(brandsAdminQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [f, setF] = useState<ProductForm>(() => formFromProduct(product));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) =>
    setF((o) => ({ ...o, [k]: v }));

  const save = async () => {
    const problem = validateProductForm(f);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    const brand = brands.find((b) => b.id === f.brand_id);
    const payload = {
      name: f.name.trim(),
      slug: f.slug.trim() || slugify(f.name),
      sku: f.sku.trim() || null,
      brand_id: brand?.id ?? null,
      brand: brand?.name ?? "",
      category_id: f.category_id || null,
      description: f.description,
      price: Number(f.price === "" ? 0 : f.price),
      old_price: f.old_price === "" ? null : Number(f.old_price),
      sizes: commaList(f.sizes),
      colors: commaList(f.colors),
      stock_status: f.stock_status,
      active: f.active,
      featured: f.featured,
      is_new: f.is_new,
    };
    const result = product
      ? await supabase.from("products").update(payload).eq("id", product.id).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single();
    setBusy(false);
    if (result.error) {
      toast.error(errorMessage(result.error));
      return;
    }
    toast.success(
      product
        ? "Produto salvo."
        : "Produto criado. Agora você pode enviar fotos e preencher as outras abas.",
    );
    invalidateProduct(qc, result.data.id);
    onSaved(result.data.id);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {product?.is_demo && (
        <p className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <Badge variant="outline">DEMO</Badge> Produto de demonstração: sem dados comerciais reais.
          Não publique como se fosse um item à venda.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field
          label="SKU"
          hint="Código único do produto. Letras, números, ponto, hífen ou sublinhado."
        >
          <Input value={f.sku} onChange={(e) => set("sku", e.target.value)} className="font-mono" />
        </Field>
        <Field label="Marca">
          <select
            className={selectClass}
            value={f.brand_id}
            onChange={(e) => set("brand_id", e.target.value)}
          >
            <option value="">Sem marca</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Setor">
          <select
            className={selectClass}
            value={f.category_id}
            onChange={(e) => set("category_id", e.target.value)}
          >
            <option value="">Sem setor</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preço (R$)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={f.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </Field>
        <Field label="Preço antigo (promoção)" hint="Deve ser maior que o preço atual.">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={f.old_price}
            onChange={(e) => set("old_price", e.target.value)}
          />
        </Field>
        <Field label="Tamanhos (separados por vírgula)">
          <Input value={f.sizes} onChange={(e) => set("sizes", e.target.value)} />
        </Field>
        <Field label="Cores (separadas por vírgula)">
          <Input value={f.colors} onChange={(e) => set("colors", e.target.value)} />
        </Field>
        {!hasInventory && (
          <Field
            label="Disponibilidade"
            hint="Com estoque por quantidade (aba Estoque), isto passa a ser automático."
          >
            <select
              className={selectClass}
              value={f.stock_status}
              onChange={(e) => set("stock_status", e.target.value)}
            >
              <option value="in_stock">Disponível</option>
              <option value="out_of_stock">Indisponível</option>
            </select>
          </Field>
        )}
        <Field label="Endereço (slug)" hint="Deixe em branco para gerar a partir do nome.">
          <Input
            value={f.slug}
            onChange={(e) => set("slug", e.target.value)}
            className="font-mono"
          />
        </Field>
      </div>
      <Field label="Descrição">
        <Textarea
          rows={4}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-6">
        {(
          [
            ["active", "Ativo (aparece na loja)"],
            ["featured", "Destaque"],
            ["is_new", "Lançamento"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Switch checked={f[k]} onCheckedChange={(v) => set(k, v)} aria-label={label} /> {label}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}{" "}
          {product ? "Salvar dados" : "Criar produto"}
        </Button>
      </div>
    </form>
  );
}
