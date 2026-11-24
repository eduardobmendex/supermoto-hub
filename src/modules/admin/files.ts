/**
 * Validation of the files the administration uploads. Pure functions, so they can be tested without a
 * browser and reused by every upload field.
 */

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_MODEL_BYTES = 50 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type Validation = { ok: true } | { ok: false; error: string };
const invalid = (error: string): Validation => ({ ok: false, error });

export function validatePhoto(file: { name: string; type: string; size: number }): Validation {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type))
    return invalid(`"${file.name}": use JPG, PNG ou WebP.`);
  if (file.size > MAX_PHOTO_BYTES) return invalid(`"${file.name}": a imagem deve ter até 15 MB.`);
  return { ok: true };
}

/** `glTF` in ASCII: every binary glTF starts with it. */
const isGlbMagic = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x67 &&
  bytes[1] === 0x6c &&
  bytes[2] === 0x54 &&
  bytes[3] === 0x46;

export type ModelKind = "model_glb" | "model_gltf";

/**
 * Checks a 3D model before it is stored. A `.gltf` is accepted only when self-contained: its external
 * `.bin` and texture files would not exist next to the single uploaded file.
 */
export function validateModelFile(
  name: string,
  buffer: ArrayBuffer,
): Validation & { kind?: ModelKind } {
  if (buffer.byteLength > MAX_MODEL_BYTES) return invalid("O modelo deve ter até 50 MB.");
  const lower = name.toLowerCase();
  if (lower.endsWith(".glb")) {
    if (buffer.byteLength < 12 || !isGlbMagic(new Uint8Array(buffer, 0, 4)))
      return invalid("O arquivo não é um GLB válido.");
    const view = new DataView(buffer);
    if (view.getUint32(4, true) !== 2) return invalid("Somente GLB na versão 2 é suportado.");
    if (view.getUint32(8, true) !== buffer.byteLength)
      return invalid("O GLB está corrompido ou incompleto.");
    return { ok: true, kind: "model_glb" };
  }
  if (lower.endsWith(".gltf")) {
    let doc: {
      asset?: { version?: unknown };
      buffers?: { uri?: string }[];
      images?: { uri?: string }[];
    };
    try {
      doc = JSON.parse(new TextDecoder().decode(buffer));
    } catch {
      return invalid("O arquivo não é um glTF válido.");
    }
    if (!String(doc?.asset?.version ?? "").startsWith("2"))
      return invalid("Somente glTF na versão 2 é suportado.");
    const external = [...(doc.buffers ?? []), ...(doc.images ?? [])].some(
      (r) => r.uri && !r.uri.startsWith("data:"),
    );
    if (external)
      return invalid(
        "Este glTF depende de arquivos externos. Envie como .glb ou com os recursos embutidos.",
      );
    return { ok: true, kind: "model_gltf" };
  }
  return invalid("Envie um arquivo .glb ou .gltf.");
}

/** Orders file names the way people count: frame2 before frame10. Used to number the 360° frames. */
export function naturalSort<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "pt", { numeric: true, sensitivity: "base" }),
  );
}

/** Where a new item goes when it is appended to an ordered list. */
export const nextSortOrder = (items: { sort_order: number }[]) =>
  items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;

/** Swaps the position of two neighbours and returns the new order values to persist. */
export function moveItem<T extends { id: string; sort_order: number }>(
  items: T[],
  id: string,
  delta: -1 | 1,
): { id: string; sort_order: number }[] {
  const ordered = [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const i = ordered.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ordered.length) return [];
  [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
  // Renumbering every item keeps the order valid even if values were duplicated.
  return ordered.map((item, index) => ({ id: item.id, sort_order: index }));
}

/** Error text for people: PostgREST errors are plain objects, not Error instances. */
export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  if (/duplicate key.*sku|products_sku/i.test(raw)) return "Já existe um produto com este SKU.";
  if (/duplicate key.*slug|_slug_key/i.test(raw))
    return "Já existe um registro com este endereço (slug).";
  if (/products_old_price_above_price/i.test(raw))
    return "O preço antigo precisa ser maior que o preço atual.";
  if (/products_price_nonneg/i.test(raw)) return "O preço não pode ser negativo.";
  if (/products_sku_format/i.test(raw))
    return "SKU inválido: use letras, números, ponto, hífen ou sublinhado (2 a 40 caracteres).";
  if (/products_slug_format|slug_check/i.test(raw))
    return "Endereço (slug) inválido: use letras minúsculas, números e hífens.";
  if (/violates foreign key.*restrict|still referenced/i.test(raw))
    return "Não é possível excluir: há registros que dependem deste.";
  if (/row-level security|permission denied/i.test(raw))
    return "Você não tem permissão para esta ação.";
  return raw || "Erro inesperado.";
}
