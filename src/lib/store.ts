import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;
export type Settings = Tables<"store_settings">;
export type Spec = { label: string; value: string };

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function whatsappLink(phone: string, product: { name: string; price: number }, url: string) {
  const msg = `Olá! Tenho interesse neste produto:\n\nProduto: ${product.name}\nPreço: ${formatBRL(product.price)}\nLink: ${url}\n\nGostaria de mais informações sobre disponibilidade e formas de pagamento.`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

/**
 * What the storefront reads: the product plus its photos, specifications and brand from the catalog
 * tables (product_media, product_specs, brands). Row-level security only returns them for active products.
 */
export const STOREFRONT_SELECT =
  "*, brands(name), product_media(url, kind, alt, sort_order, is_primary), product_specs(label, value, sort_order)" as const;

type StorefrontRow = Product & {
  brands?: { name: string } | null;
  product_media?: {
    url: string | null;
    kind: string;
    alt: string;
    sort_order: number;
    is_primary: boolean;
  }[];
  product_specs?: { label: string; value: string; sort_order: number }[];
};

/** Puts a storefront row in the shape the components use: images and specs come from the catalog tables. */
export function toStorefrontProduct(row: StorefrontRow): Product {
  const { brands, product_media, product_specs, ...product } = row;
  const images = (product_media ?? [])
    .filter((m) => m.kind === "image" && m.url)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
    .map((m) => m.url as string);
  const specs = [...(product_specs ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ label: s.label, value: s.value }));
  return { ...product, brand: brands?.name ?? product.brand, images, specs };
}

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select(STOREFRONT_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toStorefrontProduct);
  },
});

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(STOREFRONT_SELECT)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? toStorefrontProduct(data) : null;
    },
  });

/** Uploads a file to the private bucket and returns a long-lived signed URL. */
export async function uploadFile(file: File, folder: string) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage
    .from("products")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2) throw e2;
  return data.signedUrl;
}

/** Like uploadFile, but also returns the storage path, so the file can be deleted when its record is removed. */
export async function uploadProductFile(
  file: File,
  folder: string,
  options?: { contentType?: string; cacheControl?: string },
) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("products")
    .upload(path, file, { upsert: false, ...options });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage
    .from("products")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signError) throw signError;
  return { path, url: data.signedUrl };
}

export async function removeProductFiles(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from("products").remove(paths);
  if (error) throw error;
}

export const STATUS_LABEL: Record<string, string> = {
  none: "Sem modelo 3D",
  processing: "Gerando modelo 3D…",
  ready: "Modelo 3D pronto",
  failed: "Falha na geração",
};
