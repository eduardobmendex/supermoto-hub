import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI image-to-3D pipeline. Provider: Meshy (https://www.meshy.ai) via MESHY_API_KEY.
 * Async: `start` creates a job and returns immediately; `check` polls and, when done,
 * stores the GLB in storage and attaches it to the product.
 */
const MESHY = "https://api.meshy.ai/openapi/v1/image-to-3d";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito à administração.");
}

export const startModelGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: p, error } = await supabase.from("products").select("images").eq("id", data.productId).single();
    if (error || !p) throw new Error("Produto não encontrado.");
    if (!p.images.length) throw new Error("Envie ao menos uma fotografia antes de gerar o 3D.");

    const key = process.env["MESHY_API_KEY"];
    if (!key) {
      await supabase.from("products").update({ model_status: "failed", model_error: "Serviço de geração 3D por IA ainda não configurado. Faça upload manual de um GLB ou configure a chave do serviço." }).eq("id", data.productId);
      return { ok: false };
    }
    const res = await fetch(MESHY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: p.images[0], should_texture: true, enable_pbr: true }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.result) {
      await supabase.from("products").update({ model_status: "failed", model_error: body.message ?? `Erro do serviço 3D (${res.status})` }).eq("id", data.productId);
      return { ok: false };
    }
    await supabase.from("products").update({ model_status: "processing", model_error: null, model_job_id: body.result, model_approved: false }).eq("id", data.productId);
    return { ok: true };
  });

export const checkModelGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: p } = await supabase.from("products").select("model_job_id, model_status").eq("id", data.productId).single();
    if (!p?.model_job_id || p.model_status !== "processing") return { status: p?.model_status ?? "none" };
    const key = process.env["MESHY_API_KEY"];
    if (!key) return { status: "processing" };
    const res = await fetch(`${MESHY}/${p.model_job_id}`, { headers: { Authorization: `Bearer ${key}` } });
    const job = await res.json().catch(() => ({}));
    if (job.status === "FAILED" || job.status === "CANCELED") {
      await supabase.from("products").update({ model_status: "failed", model_error: job.task_error?.message ?? "A geração falhou." }).eq("id", data.productId);
      return { status: "failed" };
    }
    if (job.status !== "SUCCEEDED" || !job.model_urls?.glb) return { status: "processing", progress: job.progress ?? 0 };

    const glb = await fetch(job.model_urls.glb).then((r) => r.arrayBuffer());
    const path = `models/${data.productId}-${Date.now()}.glb`;
    const up = await supabase.storage.from("products").upload(path, glb, { contentType: "model/gltf-binary" });
    if (up.error) throw new Error(up.error.message);
    const { data: signed } = await supabase.storage.from("products").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    await supabase.from("products").update({ model_status: "ready", model_url: signed?.signedUrl ?? null, model_error: null }).eq("id", data.productId);
    return { status: "ready" };
  });
