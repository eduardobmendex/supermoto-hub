import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, removeProductFiles } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  invalidateProduct,
  productInventoryQuery,
  productsAdminQuery,
  type ProductListRow,
} from "../api";
import { EmptyNote } from "../fields";
import { errorMessage } from "../files";
import { DataTab } from "./DataTab";
import { ExperienceTab } from "./ExperienceTab";
import { FitmentsTab } from "./FitmentsTab";
import { PhotosTab } from "./PhotosTab";
import { SpecsTab } from "./SpecsTab";
import { StockTab } from "./StockTab";

const thumb = (p: ProductListRow) => {
  const images = p.product_media
    .filter((m) => m.kind === "image")
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  return images[0]?.url ?? null;
};

export function ProductsAdmin() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery(productsAdminQuery);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [term, setTerm] = useState("");
  const t = term.trim().toLowerCase();
  const shown = t
    ? products.filter((p) =>
        `${p.name} ${p.sku ?? ""} ${p.brands?.name ?? ""}`.toLowerCase().includes(t),
      )
    : products;

  const remove = async (p: ProductListRow) => {
    if (
      !confirm(
        `Excluir "${p.name}"? Fotos, características, estoque e compatibilidades dele também serão apagados.`,
      )
    )
      return;
    const { data: files } = await supabase
      .from("product_media")
      .select("storage_path")
      .eq("product_id", p.id);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    await removeProductFiles(
      (files ?? []).flatMap((f) => (f.storage_path ? [f.storage_path] : [])),
    ).catch(() =>
      toast.warning("O produto foi excluído, mas alguns arquivos ficaram no armazenamento."),
    );
    invalidateProduct(qc, p.id);
  };

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-2xl font-bold uppercase">Produtos</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar nome, SKU ou marca"
            aria-label="Buscar produtos"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setEditing({})}>
          <Plus /> Novo produto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : shown.length ? (
        <div className="divide-y rounded-lg border bg-card">
          {shown.map((p) => {
            const image = thumb(p);
            const tracked = p.inventory[0];
            return (
              <div key={p.id} className="flex items-center gap-4 p-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-stage">
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="tech text-muted-foreground">
                    {p.sku ?? "sem SKU"} · {p.categories?.name ?? "sem setor"} ·{" "}
                    {p.brands?.name ?? "sem marca"} · {formatBRL(Number(p.price))}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-1 md:flex">
                  {p.is_demo && <Badge variant="outline">DEMO</Badge>}
                  {!p.active && <Badge variant="outline">Inativo</Badge>}
                  {p.featured && <Badge variant="secondary">Destaque</Badge>}
                  <Badge variant={p.stock_status === "in_stock" ? "secondary" : "outline"}>
                    {tracked
                      ? `${tracked.quantity} em estoque`
                      : p.stock_status === "in_stock"
                        ? "Disponível"
                        : "Indisponível"}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => setEditing({ id: p.id })}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Excluir ${p.name}`}
                  onClick={() => void remove(p)}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyNote>
          {t
            ? "Nenhum produto encontrado para esta busca."
            : 'Nenhum produto ainda. Clique em "Novo produto".'}
        </EmptyNote>
      )}

      {editing && (
        <ProductEditor
          key={editing.id ?? "new"}
          initialId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ProductEditor({
  initialId,
  onClose,
}: {
  initialId?: string | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsAdminQuery);
  const [id, setId] = useState(initialId);
  const [tab, setTab] = useState("dados");
  const product = products.find((p) => p.id === id);
  const { data: inventory } = useQuery({ ...productInventoryQuery(id ?? "none"), enabled: !!id });
  const saved = !!id && !!product;

  return (
    <Dialog open onOpenChange={(open) => !open && (invalidateProduct(qc, id), onClose())}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? product.name : "Novo produto"}</DialogTitle>
          <DialogDescription>
            {saved
              ? `SKU ${product.sku ?? "não definido"}`
              : "Salve os dados básicos para liberar fotos, características, estoque e as demais abas."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="fotos" disabled={!saved}>
              Fotos
            </TabsTrigger>
            <TabsTrigger value="specs" disabled={!saved}>
              Características
            </TabsTrigger>
            <TabsTrigger value="estoque" disabled={!saved}>
              Estoque
            </TabsTrigger>
            <TabsTrigger value="compat" disabled={!saved}>
              Compatibilidade
            </TabsTrigger>
            <TabsTrigger value="exp" disabled={!saved}>
              Experiência
            </TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="dados">
              <DataTab
                key={product?.id ?? "new"}
                product={product}
                hasInventory={!!inventory}
                onSaved={(newId) => setId(newId)}
              />
            </TabsContent>
            {saved && (
              <>
                <TabsContent value="fotos">
                  <PhotosTab productId={product.id} productName={product.name} />
                </TabsContent>
                <TabsContent value="specs">
                  <SpecsTab productId={product.id} />
                </TabsContent>
                <TabsContent value="estoque">
                  <StockTab productId={product.id} />
                </TabsContent>
                <TabsContent value="compat">
                  <FitmentsTab productId={product.id} />
                </TabsContent>
                <TabsContent value="exp">
                  <ExperienceTab productId={product.id} />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
