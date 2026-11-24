import { slugify, type Product } from "@/lib/store";

/** Same formats the database enforces (docs/schema.sql), checked first so people get a clear message. */
export const SKU_FORMAT = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
export const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type ProductForm = {
  name: string;
  slug: string;
  sku: string;
  brand_id: string;
  category_id: string;
  price: string;
  old_price: string;
  description: string;
  sizes: string;
  colors: string;
  stock_status: string;
  active: boolean;
  featured: boolean;
  is_new: boolean;
};

export const commaList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const formFromProduct = (p?: Product): ProductForm => ({
  name: p?.name ?? "",
  slug: p?.slug ?? "",
  sku: p?.sku ?? "",
  brand_id: p?.brand_id ?? "",
  category_id: p?.category_id ?? "",
  price: p ? String(p.price) : "",
  old_price: p?.old_price != null ? String(p.old_price) : "",
  description: p?.description ?? "",
  sizes: (p?.sizes ?? []).join(", "),
  colors: (p?.colors ?? []).join(", "),
  stock_status: p?.stock_status ?? "in_stock",
  active: p?.active ?? false,
  featured: p?.featured ?? false,
  is_new: p?.is_new ?? false,
});

export function validateProductForm(f: ProductForm): string | null {
  if (!f.name.trim()) return "Informe o nome do produto.";
  const slug = f.slug.trim() || slugify(f.name);
  if (!SLUG_FORMAT.test(slug))
    return "Endereço (slug) inválido: use letras minúsculas, números e hífens.";
  if (f.sku.trim() && !SKU_FORMAT.test(f.sku.trim()))
    return "SKU inválido: use letras, números, ponto, hífen ou sublinhado (2 a 40 caracteres).";
  const price = Number(f.price === "" ? 0 : f.price);
  if (!Number.isFinite(price) || price < 0) return "O preço não pode ser negativo.";
  if (f.old_price !== "") {
    const old = Number(f.old_price);
    if (!Number.isFinite(old) || old <= price)
      return "O preço antigo precisa ser maior que o preço atual.";
  }
  return null;
}
