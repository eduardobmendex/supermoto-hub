import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { removeProductFiles, uploadProductFile } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPERIENCE_TYPES,
  invalidateProduct,
  missingExperienceAssets,
  productExperienceQuery,
  productMediaQuery,
  type Experience,
  type ExperienceType,
  type Media,
} from "../api";
import { Field, selectClass } from "../fields";
import {
  errorMessage,
  naturalSort,
  nextSortOrder,
  validateModelFile,
  validatePhoto,
} from "../files";

const HINTS: Record<ExperienceType, string> = {
  standard: "A galeria de fotos comum. Precisa de pelo menos 1 foto.",
  image_360:
    "O cliente gira o produto arrastando. Precisa de uma sequência de pelo menos 12 quadros, numerados sem falhas.",
  interactive_3d: "Modelo 3D real, com zoom e rotação. Precisa de um arquivo GLB ou GLTF.",
  exploded:
    'Vista explodida do produto. Precisa de um modelo e da lista de peças em {"parts": [...]}.',
  installed:
    'Mostra o produto instalado. Precisa de uma foto marcada como "instalado" (meta.role = installed).',
  configurator:
    'Troca de cores e acabamentos. Precisa de um modelo e das opções em {"options": [...]}.',
};

export function ExperienceTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery(productExperienceQuery(productId));
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-8">
      <ExperienceForm key={data?.id ?? "none"} productId={productId} saved={data ?? null} />
      <FilesSection productId={productId} />
    </div>
  );
}

function ExperienceForm({ productId, saved }: { productId: string; saved: Experience | null }) {
  const qc = useQueryClient();
  const [type, setType] = useState<ExperienceType>((saved?.type as ExperienceType) ?? "standard");
  const [configText, setConfigText] = useState(JSON.stringify(saved?.config ?? {}, null, 2));
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [busy, setBusy] = useState(false);

  let config: unknown = null;
  let configError: string | null = null;
  try {
    config = JSON.parse(configText || "{}");
    if (typeof config !== "object" || config === null || Array.isArray(config))
      configError = "A configuração deve ser um objeto JSON, como {}.";
  } catch {
    configError = "JSON inválido.";
  }

  // Same rule the database enforces; the arrival of new media (via the cache) re-runs it.
  const { data: media = [] } = useQuery(productMediaQuery(productId));
  const { data: missing, isFetching } = useQuery({
    queryKey: [
      "admin",
      "experience-missing",
      productId,
      type,
      configText,
      media.length,
      media.map((m) => m.sequence_index ?? "").join(","),
    ],
    queryFn: () => missingExperienceAssets(productId, type, config),
    enabled: !configError,
  });
  const ready = !configError && (missing?.length ?? 1) === 0;

  const save = async () => {
    if (configError) {
      toast.error(configError);
      return;
    }
    setBusy(true);
    const row = { product_id: productId, type, config: config as never, enabled: enabled && ready };
    const { error } = saved
      ? await supabase.from("product_experiences").update(row).eq("id", saved.id)
      : await supabase.from("product_experiences").insert(row);
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    if (enabled && !ready) setEnabled(false);
    toast.success(
      enabled && ready ? "Experiência salva e habilitada na loja." : "Experiência salva.",
    );
    invalidateProduct(qc, productId);
  };

  return (
    <div className="space-y-4">
      <Field label="Tipo de experiência" hint={HINTS[type]}>
        <select
          className={selectClass}
          value={type}
          onChange={(e) => setType(e.target.value as ExperienceType)}
        >
          {Object.entries(EXPERIENCE_TYPES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Configuração (JSON)"
        hint="Dados extras da experiência. Em branco ou {} quando não houver."
      >
        <Textarea
          rows={4}
          className="font-mono text-xs"
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          aria-invalid={!!configError}
        />
        {configError && <p className="text-xs text-destructive">{configError}</p>}
      </Field>

      <div className="rounded-md border p-3" aria-live="polite">
        <p className="tech mb-2 text-muted-foreground">O que falta para habilitar</p>
        {configError ? (
          <p className="text-sm text-muted-foreground">Corrija a configuração para verificar.</p>
        ) : isFetching && !missing ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Verificando…
          </p>
        ) : ready ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> Tudo pronto: pode ser habilitada.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(missing ?? []).map((item) => (
              <li key={item} className="flex gap-2 text-muted-foreground">
                <Circle className="mt-0.5 size-3.5 shrink-0" /> {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className={`flex items-center gap-2 text-sm ${ready ? "" : "opacity-60"}`}>
        <Switch
          checked={enabled && ready}
          disabled={!ready}
          onCheckedChange={setEnabled}
          aria-label="Habilitar na loja"
        />{" "}
        Habilitar na loja
      </label>
      <Button type="button" disabled={busy || !!configError} onClick={() => void save()}>
        Salvar experiência
      </Button>
    </div>
  );
}

function FilesSection({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: media = [] } = useQuery(productMediaQuery(productId));
  const models = media.filter((m) => m.kind === "model_glb" || m.kind === "model_gltf");
  const frames = media
    .filter((m) => m.kind === "frame_360")
    .sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0));
  const [busy, setBusy] = useState<"model" | "frames" | null>(null);
  const refresh = () => invalidateProduct(qc, productId);

  const uploadModel = async (file?: File) => {
    if (!file) return;
    setBusy("model");
    try {
      const result = validateModelFile(file.name, await file.arrayBuffer());
      if (!result.ok || !result.kind)
        throw new Error(result.ok ? "Arquivo inválido." : result.error);
      const contentType = result.kind === "model_glb" ? "model/gltf-binary" : "model/gltf+json";
      const { path, url } = await uploadProductFile(file, `products/${productId}/models`, {
        contentType,
        cacheControl: "31536000",
      });
      const { error } = await supabase.from("product_media").insert({
        product_id: productId,
        kind: result.kind,
        url,
        storage_path: path,
        alt: file.name,
        sort_order: nextSortOrder(models),
      });
      if (error) {
        await removeProductFiles([path]).catch(() => {});
        throw error;
      }
      toast.success("Modelo enviado.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setBusy(null);
    refresh();
  };

  const uploadFrames = async (files: FileList | null) => {
    if (!files?.length) return;
    const chosen = naturalSort(Array.from(files));
    const bad = chosen.map(validatePhoto).find((r) => !r.ok);
    if (bad && !bad.ok) {
      toast.error(bad.error);
      return;
    }
    setBusy("frames");
    try {
      // Frames continue the sequence with no gaps: the database refuses to enable a 360° with holes in it.
      let index = frames.length;
      for (const file of chosen) {
        const { path, url } = await uploadProductFile(file, `products/${productId}/frames`);
        const { error } = await supabase.from("product_media").insert({
          product_id: productId,
          kind: "frame_360",
          url,
          storage_path: path,
          alt: `Quadro ${index + 1}`,
          sort_order: index,
          sequence_index: index,
        });
        if (error) {
          await removeProductFiles([path]).catch(() => {});
          throw error;
        }
        index++;
      }
      toast.success(`${chosen.length} quadros enviados, em ordem de nome de arquivo.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setBusy(null);
    refresh();
  };

  const removeMedia = async (m: Media) => {
    if (!confirm("Remover este arquivo?")) return;
    const { error } = await supabase.from("product_media").delete().eq("id", m.id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    if (m.storage_path) await removeProductFiles([m.storage_path]).catch(() => {});
    refresh();
  };

  // After a frame is removed the sequence has a hole. Two passes avoid colliding with the unique index.
  const renumberFrames = async () => {
    try {
      for (const [i, f] of frames.entries()) {
        const { error } = await supabase
          .from("product_media")
          .update({ sequence_index: 100000 + i, sort_order: 100000 + i })
          .eq("id", f.id);
        if (error) throw error;
      }
      for (const [i, f] of frames.entries()) {
        const { error } = await supabase
          .from("product_media")
          .update({ sequence_index: i, sort_order: i })
          .eq("id", f.id);
        if (error) throw error;
      }
      toast.success("Quadros renumerados sem falhas.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
    refresh();
  };

  const hasGap = frames.some((f, i) => f.sequence_index !== i);

  return (
    <div className="space-y-6 border-t pt-6">
      <section className="space-y-3">
        <h4 className="font-display text-lg font-semibold uppercase">Modelo 3D (GLB/GLTF)</h4>
        <p className="text-sm text-muted-foreground">
          GLB ou GLTF com tudo embutido, até 50 MB. O arquivo é verificado antes de ser salvo.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:border-primary">
          {busy === "model" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}{" "}
          Enviar modelo
          <input
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            hidden
            disabled={busy !== null}
            onChange={(e) => {
              void uploadModel(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {models.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-md border bg-card p-2 text-sm">
            <span className="tech text-muted-foreground">
              {m.kind === "model_glb" ? "GLB" : "GLTF"}
            </span>
            <span className="min-w-0 flex-1 truncate">{m.alt}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remover o modelo ${m.alt}`}
              onClick={() => void removeMedia(m)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h4 className="font-display text-lg font-semibold uppercase">Quadros da rotação 360°</h4>
        <p className="text-sm text-muted-foreground">
          Fotos do produto em volta de um eixo, no mesmo enquadramento. Os arquivos são numerados
          pela ordem do nome (foto2 vem antes de foto10). Mínimo de 12.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:border-primary">
          {busy === "frames" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}{" "}
          Enviar quadros
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            disabled={busy !== null}
            onChange={(e) => {
              void uploadFrames(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="tech text-muted-foreground">
          {frames.length} {frames.length === 1 ? "quadro" : "quadros"}
          {frames.length > 0 &&
            frames.length < 12 &&
            ` · faltam ${12 - frames.length} para o mínimo`}
        </p>
        {hasGap && (
          <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm">
            <span className="flex-1">
              A sequência tem falhas na numeração. A rotação 360° não pode ser habilitada assim.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => void renumberFrames()}>
              Renumerar
            </Button>
          </div>
        )}
        {frames.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {frames.map((f) => (
              <li key={f.id} className="relative size-16 overflow-hidden rounded border bg-stage">
                {f.url && (
                  <img
                    src={f.url}
                    alt={f.alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
                <span className="tech absolute bottom-0 left-0 bg-background/80 px-1 text-[10px]">
                  {(f.sequence_index ?? 0) + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remover o quadro ${(f.sequence_index ?? 0) + 1}`}
                  className="absolute right-0 top-0 bg-background/80 p-0.5"
                  onClick={() => void removeMedia(f)}
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
