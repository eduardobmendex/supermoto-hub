import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Brand = Tables<"brands">;
export type Motorcycle = Tables<"motorcycles">;
export type MotorcycleVersion = Tables<"motorcycle_versions">;
export type Media = Tables<"product_media">;
export type SpecRow = Tables<"product_specs">;
export type InventoryRow = Tables<"inventory">;
export type Experience = Tables<"product_experiences">;
export type Fitment = Tables<"product_fitments">;

/** A motorcycle with its maker and versions, as the motorcycles screen loads it. */
export type MotorcycleWithVersions = Motorcycle & {
  brands: { name: string } | null;
  motorcycle_versions: { id: string; year: number; version: string }[];
};

/** A product as the products list loads it, with the pieces the table shows. */
export type ProductListRow = Tables<"products"> & {
  brands: { name: string } | null;
  categories: { name: string } | null;
  inventory: { quantity: number }[];
  product_media: { url: string | null; kind: string; is_primary: boolean; sort_order: number }[];
};

export const BRAND_KINDS = {
  part: "Peças",
  motorcycle: "Motocicletas",
  both: "Peças e motocicletas",
} as const;

export const EXPERIENCE_TYPES = {
  standard: "Padrão (galeria de fotos)",
  image_360: "Rotação 360°",
  interactive_3d: "3D interativo",
  exploded: "Vista explodida",
  installed: "Vista instalada",
  configurator: "Configurador",
} as const;
export type ExperienceType = keyof typeof EXPERIENCE_TYPES;

/** Throws the PostgREST error (a plain object) as a real Error so callers can show its message. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Refreshes everything that shows a product: the admin lists and the storefront. */
export function invalidateProduct(
  qc: { invalidateQueries: (o: { queryKey: unknown[] }) => unknown },
  productId?: string,
) {
  qc.invalidateQueries({ queryKey: ["admin", "products"] });
  if (productId)
    for (const part of ["media", "specs", "inventory", "experience", "fitments"])
      qc.invalidateQueries({ queryKey: ["admin", part, productId] });
  for (const key of ["products", "product", "catalog", "rail", "related", "catalog-size"])
    qc.invalidateQueries({ queryKey: [key] });
}

export const brandsAdminQuery = queryOptions({
  queryKey: ["admin", "brands"],
  queryFn: async () => unwrap(await supabase.from("brands").select("*").order("name")),
});

export const motorcyclesAdminQuery = queryOptions({
  queryKey: ["admin", "motorcycles"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("motorcycles")
        .select("*, brands(name), motorcycle_versions(id, year, version)")
        .order("model")
        .order("year", { referencedTable: "motorcycle_versions" }),
    ),
});

export const productsAdminQuery = queryOptions({
  queryKey: ["admin", "products"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("products")
        .select(
          "*, brands(name), categories(name), inventory(quantity), product_media(url, kind, is_primary, sort_order)",
        )
        .order("created_at", { ascending: false })
        .limit(500),
    ),
});

export const productMediaQuery = (productId: string) =>
  queryOptions({
    queryKey: ["admin", "media", productId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("product_media")
          .select("*")
          .eq("product_id", productId)
          .order("sort_order")
          .order("created_at"),
      ),
  });

export const productSpecsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["admin", "specs", productId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("product_specs")
          .select("*")
          .eq("product_id", productId)
          .order("sort_order"),
      ),
  });

export const productInventoryQuery = (productId: string) =>
  queryOptions({
    queryKey: ["admin", "inventory", productId],
    queryFn: async (): Promise<InventoryRow | null> => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("product_id", productId)
        .is("variant_id", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const productExperienceQuery = (productId: string) =>
  queryOptions({
    queryKey: ["admin", "experience", productId],
    queryFn: async (): Promise<Experience | null> => {
      const { data, error } = await supabase
        .from("product_experiences")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const productFitmentsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["admin", "fitments", productId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("product_fitments")
          .select("*, motorcycle_versions(year, version, motorcycles(model, brands(name)))")
          .eq("product_id", productId)
          .order("created_at"),
      ),
  });

/** What is still missing for an experience type to be enabled (empty list = ready). Same rule the database enforces. */
export async function missingExperienceAssets(
  productId: string,
  type: string,
  config: unknown,
): Promise<string[]> {
  const data = unwrap(
    await supabase.rpc("experience_missing_assets", {
      p_product: productId,
      p_type: type,
      p_config: config as never,
    }),
  );
  return data ?? [];
}
