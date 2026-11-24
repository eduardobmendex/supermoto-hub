import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Star, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { removeProductFiles, uploadProductFile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invalidateProduct, productMediaQuery, type Media } from "../api";
import { EmptyNote } from "../fields";
import { errorMessage, moveItem, nextSortOrder, validatePhoto } from "../files";

export function PhotosTab({ productId, productName }: { productId: string; productName: string }) {
  const qc = useQueryClient();
  const { data: media = [], isLoading } = useQuery(productMediaQuery(productId));
  const images = media.filter((m) => m.kind === "image");
  const [busy, setBusy] = useState(false);
  const refresh = () => invalidateProduct(qc, productId);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const chosen = Array.from(files);
    const bad = chosen.map(validatePhoto).find((r) => !r.ok);
    if (bad && !bad.ok) {
      toast.error(bad.error);
      return;
    }
    setBusy(true);
    try {
      let order = nextSortOrder(images);
      let hasPrimary = images.some((i) => i.is_primary);
      for (const file of chosen) {
        const { path, url } = await uploadProductFile(file, `products/${productId}/images`);
        const { error } = await supabase.from("product_media").insert({
          product_id: productId,
          kind: "image",
          url,
          storage_path: path,
          alt: productName,
          sort_order: order++,
          is_primary: !hasPrimary,
        });
        if (error) {
          await removeProductFiles([path]).catch(() => {});
          throw error;
        }
        hasPrimary = true;
      }
      toast.success(chosen.length === 1 ? "Foto enviada." : `${chosen.length} fotos enviadas.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setBusy(false);
    refresh();
  };

  const makePrimary = async (id: string) => {
    // Only one primary per product: the old one is released first.
    const current = images.find((i) => i.is_primary);
    if (current && current.id !== id) {
      const released = await supabase
        .from("product_media")
        .update({ is_primary: false })
        .eq("id", current.id);
      if (released.error) {
        toast.error(errorMessage(released.error));
        return;
      }
    }
    const { error } = await supabase
      .from("product_media")
      .update({ is_primary: true })
      .eq("id", id);
    if (error) toast.error(errorMessage(error));
    refresh();
  };

  const move = async (id: string, delta: -1 | 1) => {
    for (const { id: rowId, sort_order } of moveItem(images, id, delta)) {
      const { error } = await supabase.from("product_media").update({ sort_order }).eq("id", rowId);
      if (error) {
        toast.error(errorMessage(error));
        return;
      }
    }
    refresh();
  };

  const remove = async (image: Media) => {
    if (!confirm("Remover esta foto?")) return;
    const { error } = await supabase.from("product_media").delete().eq("id", image.id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    if (image.storage_path)
      await removeProductFiles([image.storage_path]).catch(() =>
        toast.warning(
          "A foto saiu do produto, mas o arquivo não pôde ser apagado do armazenamento.",
        ),
      );
    const next = images.find((i) => i.id !== image.id);
    if (image.is_primary && next)
      await supabase.from("product_media").update({ is_primary: true }).eq("id", next.id);
    refresh();
  };

  const saveAlt = async (id: string, alt: string) => {
    const { error } = await supabase.from("product_media").update({ alt }).eq("id", id);
    if (error) toast.error(errorMessage(error));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        JPG, PNG ou WebP de até 15 MB. A foto com a estrela é a principal (aparece na listagem). Use
        a descrição para acessibilidade.
      </p>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:border-primary">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}{" "}
        {busy ? "Enviando…" : "Enviar fotos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : images.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {images.map((image, i) => (
            <li key={image.id} className="space-y-2 rounded-md border bg-card p-2">
              <div className="relative aspect-square overflow-hidden rounded bg-stage">
                {image.url && (
                  <img src={image.url} alt={image.alt} className="h-full w-full object-contain" />
                )}
                {image.is_primary && (
                  <span className="tech absolute left-1 top-1 bg-primary px-1.5 py-0.5 text-primary-foreground">
                    Principal
                  </span>
                )}
              </div>
              <Input
                defaultValue={image.alt}
                placeholder="Descrição da foto"
                aria-label={`Descrição da foto ${i + 1}`}
                onBlur={(e) =>
                  e.target.value !== image.alt && void saveAlt(image.id, e.target.value)
                }
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Mover foto ${i + 1} para trás`}
                    disabled={i === 0}
                    onClick={() => void move(image.id, -1)}
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Mover foto ${i + 1} para frente`}
                    disabled={i === images.length - 1}
                    onClick={() => void move(image.id, 1)}
                  >
                    <ArrowRight />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Tornar a foto ${i + 1} a principal`}
                    aria-pressed={image.is_primary}
                    disabled={image.is_primary}
                    onClick={() => void makePrimary(image.id)}
                  >
                    <Star className={image.is_primary ? "fill-primary text-primary" : ""} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover a foto ${i + 1}`}
                    onClick={() => void remove(image)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>
          Nenhuma foto ainda. Sem fotos, o produto aparece com um espaço vazio na loja.
        </EmptyNote>
      )}
    </div>
  );
}
