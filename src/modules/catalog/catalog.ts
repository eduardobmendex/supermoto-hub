import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { STOREFRONT_SELECT, toStorefrontProduct, type Product } from "@/lib/store";

export const PAGE_SIZE = 24;

export const SORTS = {
  recentes: { label: "Mais recentes", column: "created_at", ascending: false },
  "preco-asc": { label: "Menor preço", column: "price", ascending: true },
  "preco-desc": { label: "Maior preço", column: "price", ascending: false },
  nome: { label: "Nome (A–Z)", column: "name", ascending: true },
} as const;
export type SortKey = keyof typeof SORTS;

/** URL state of /catalogo. Every filter is optional so links stay short. */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  setor: z.string().max(60).optional().catch(undefined),
  marca: z.string().max(60).optional().catch(undefined),
  ordem: z.enum(["recentes", "preco-asc", "preco-desc", "nome"]).optional().catch(undefined),
  disponiveis: z.boolean().optional().catch(undefined),
  pagina: z.number().int().min(1).optional().catch(undefined),
});
export type CatalogSearch = z.infer<typeof catalogSearchSchema>;

/** Characters that carry meaning inside a PostgREST `or()` filter or an ilike pattern. */
export const sanitizeTerm = (term: string) =>
  term
    .replace(/[%_,()*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type CatalogPage = {
  items: Product[];
  total: number;
  page: number;
  pages: number;
  sectorMissing: boolean;
};

async function fetchCatalog(params: CatalogSearch): Promise<CatalogPage> {
  const page = params.pagina ?? 1;
  let categoryId: string | null = null;
  if (params.setor) {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", params.setor)
      .maybeSingle();
    if (error) throw error;
    // A sector without its category has no products yet: an empty result, not an error.
    if (!data) return { items: [], total: 0, page, pages: 1, sectorMissing: true };
    categoryId = data.id;
  }

  let brandId: string | null = null;
  if (params.marca) {
    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", params.marca)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { items: [], total: 0, page, pages: 1, sectorMissing: false };
    brandId = data.id;
  }

  const sort = SORTS[params.ordem ?? "recentes"];
  let query = supabase
    .from("products")
    .select(STOREFRONT_SELECT, { count: "exact" })
    .eq("active", true);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (brandId) query = query.eq("brand_id", brandId);
  if (params.disponiveis) query = query.eq("stock_status", "in_stock");
  const term = sanitizeTerm(params.q ?? "");
  if (term)
    query = query.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%,description.ilike.%${term}%`,
    );

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const total = count ?? 0;
  return {
    items: data.map(toStorefrontProduct),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sectorMissing: false,
  };
}

export const catalogQuery = (params: CatalogSearch) =>
  queryOptions({
    queryKey: ["catalog", params],
    queryFn: () => fetchCatalog(params),
    placeholderData: (previous) => previous,
  });

/** A short, ordered list for the homepage rails. */
export const railQuery = (rail: "featured" | "new", limit = 8) =>
  queryOptions({
    queryKey: ["rail", rail, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(STOREFRONT_SELECT)
        .eq("active", true)
        .eq(rail === "featured" ? "featured" : "is_new", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data.map(toStorefrontProduct);
    },
  });

export const relatedQuery = (product: Pick<Product, "id" | "category_id">, limit = 4) =>
  queryOptions({
    queryKey: ["related", product.id, limit],
    enabled: !!product.category_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(STOREFRONT_SELECT)
        .eq("active", true)
        .eq("category_id", product.category_id!)
        .neq("id", product.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data.map(toStorefrontProduct);
    },
  });

/** Part brands that have at least one published product: the options of the catalog's brand filter. */
export const brandsWithProductsQuery = queryOptions({
  queryKey: ["catalog-brands"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("brands")
      .select("name, slug, products!inner(id)")
      .in("kind", ["part", "both"])
      .eq("products.active", true)
      .order("name");
    if (error) throw error;
    return data.map(({ name, slug }) => ({ name, slug }));
  },
});

export type PublicFitment = {
  position: string;
  notes: string;
  restrictions: string;
  label: string;
  year: number;
};

/**
 * Motorcycles a product fits. Row-level security only returns applications an administrator has
 * validated, for active products and motorcycles: the store never claims a fit that was not checked.
 */
export const fitmentsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["fitments", productId],
    queryFn: async (): Promise<PublicFitment[]> => {
      const { data, error } = await supabase
        .from("product_fitments")
        .select(
          "position, notes, restrictions, motorcycle_versions(year, version, motorcycles(model, displacement_cc, brands(name)))",
        )
        .eq("product_id", productId);
      if (error) throw error;
      return data
        .flatMap((f) => {
          const v = f.motorcycle_versions;
          if (!v?.motorcycles) return [];
          const m = v.motorcycles;
          const cc = m.displacement_cc ? ` ${m.displacement_cc} cc` : "";
          const version = v.version && v.version !== "Padrão" ? ` ${v.version}` : "";
          return [
            {
              position: f.position,
              notes: f.notes,
              restrictions: f.restrictions,
              label: `${m.brands?.name ?? ""} ${m.model}${cc}${version}`.trim(),
              year: v.year,
            },
          ];
        })
        .sort((a, b) => a.label.localeCompare(b.label, "pt") || a.year - b.year);
    },
  });

/** Total of published products: tells the homepage whether the catalog has started. */
export const catalogSizeQuery = queryOptions({
  queryKey: ["catalog-size"],
  queryFn: async () => {
    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (error) throw error;
    return count ?? 0;
  },
});

export type FitmentGroup = {
  label: string;
  years: number[];
  position: string;
  restrictions: string;
  notes: string;
};

/** One line per motorcycle and application, with its years together: "Honda CG 160 Fan 160 cc · 2023, 2024". */
export function groupFitments(fitments: PublicFitment[]): FitmentGroup[] {
  const groups = new Map<string, FitmentGroup>();
  for (const f of fitments) {
    const key = [f.label, f.position, f.restrictions, f.notes].join("|");
    const group = groups.get(key) ?? {
      label: f.label,
      years: [],
      position: f.position,
      restrictions: f.restrictions,
      notes: f.notes,
    };
    if (!group.years.includes(f.year)) group.years.push(f.year);
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({ ...g, years: g.years.sort((a, b) => a - b) }));
}
