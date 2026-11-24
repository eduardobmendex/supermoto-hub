import { describe, expect, it } from "vitest";
import {
  errorMessage,
  moveItem,
  naturalSort,
  nextSortOrder,
  validateModelFile,
  validatePhoto,
} from "@/modules/admin/files";
import { validateProductForm } from "@/modules/admin/products/validation";

function glb(opts: { length?: number; declared?: number; version?: number; magic?: string } = {}) {
  const { length = 64, version = 2, magic = "glTF" } = opts;
  const declared = opts.declared ?? length;
  const buffer = new ArrayBuffer(length);
  new Uint8Array(buffer).set([...magic].map((c) => c.charCodeAt(0)));
  const view = new DataView(buffer);
  view.setUint32(4, version, true);
  view.setUint32(8, declared, true);
  return buffer;
}
const json = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;

describe("validatePhoto", () => {
  it("accepts JPG, PNG and WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"])
      expect(validatePhoto({ name: "a", type, size: 1000 }).ok).toBe(true);
  });
  it("rejects other types, including SVG (can carry scripts)", () => {
    for (const type of ["image/svg+xml", "image/gif", "application/pdf", ""])
      expect(validatePhoto({ name: "a", type, size: 1000 }).ok).toBe(false);
  });
  it("rejects photos over 15 MB, naming the file", () => {
    const r = validatePhoto({ name: "grande.jpg", type: "image/jpeg", size: 16 * 1024 * 1024 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("grande.jpg");
  });
});

describe("validateModelFile", () => {
  it("accepts a well-formed GLB and reports its kind", () => {
    expect(validateModelFile("peca.GLB", glb())).toEqual({ ok: true, kind: "model_glb" });
  });
  it("rejects a GLB that is not binary glTF, is v1, is truncated or too large", () => {
    expect(validateModelFile("a.glb", glb({ magic: "<htm" })).ok).toBe(false);
    expect(validateModelFile("a.glb", glb({ version: 1 })).ok).toBe(false);
    expect(validateModelFile("a.glb", glb({ declared: 128 })).ok).toBe(false);
    expect(validateModelFile("a.glb", new ArrayBuffer(50 * 1024 * 1024 + 1)).ok).toBe(false);
  });
  it("accepts a self-contained glTF", () => {
    const doc = {
      asset: { version: "2.0" },
      buffers: [{ uri: "data:application/octet-stream;base64,AA==" }],
    };
    expect(validateModelFile("a.gltf", json(doc))).toEqual({ ok: true, kind: "model_gltf" });
  });
  it("rejects a glTF that needs external files, malformed JSON, or v1", () => {
    expect(
      validateModelFile(
        "a.gltf",
        json({ asset: { version: "2.0" }, buffers: [{ uri: "scene.bin" }] }),
      ).ok,
    ).toBe(false);
    expect(
      validateModelFile("a.gltf", json({ asset: { version: "2.0" }, images: [{ uri: "tex.png" }] }))
        .ok,
    ).toBe(false);
    expect(
      validateModelFile("a.gltf", new TextEncoder().encode("{").buffer as ArrayBuffer).ok,
    ).toBe(false);
    expect(validateModelFile("a.gltf", json({ asset: { version: "1.0" } })).ok).toBe(false);
  });
  it("rejects other extensions", () => {
    expect(validateModelFile("a.obj", glb()).ok).toBe(false);
    expect(validateModelFile("a.glb.exe", glb()).ok).toBe(false);
  });
});

describe("naturalSort (numbering of 360° frames)", () => {
  it("puts foto2 before foto10, unlike plain alphabetical order", () => {
    const names = ["foto10.jpg", "foto2.jpg", "foto1.jpg", "foto11.jpg"].map((name) => ({ name }));
    expect(naturalSort(names).map((f) => f.name)).toEqual([
      "foto1.jpg",
      "foto2.jpg",
      "foto10.jpg",
      "foto11.jpg",
    ]);
  });
  it("does not change the input array", () => {
    const input = [{ name: "b" }, { name: "a" }];
    naturalSort(input);
    expect(input.map((f) => f.name)).toEqual(["b", "a"]);
  });
});

describe("ordering helpers", () => {
  const items = [
    { id: "a", sort_order: 0 },
    { id: "b", sort_order: 1 },
    { id: "c", sort_order: 2 },
  ];
  it("nextSortOrder appends after the largest value", () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder(items)).toBe(3);
  });
  it("moveItem swaps neighbours and renumbers the whole list", () => {
    expect(moveItem(items, "b", -1)).toEqual([
      { id: "b", sort_order: 0 },
      { id: "a", sort_order: 1 },
      { id: "c", sort_order: 2 },
    ]);
    expect(moveItem(items, "b", 1)).toEqual([
      { id: "a", sort_order: 0 },
      { id: "c", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });
  it("moveItem does nothing at the edges or for an unknown id", () => {
    expect(moveItem(items, "a", -1)).toEqual([]);
    expect(moveItem(items, "c", 1)).toEqual([]);
    expect(moveItem(items, "zzz", 1)).toEqual([]);
  });
  it("moveItem repairs duplicated order values", () => {
    const dup = [
      { id: "a", sort_order: 5 },
      { id: "b", sort_order: 5 },
      { id: "c", sort_order: 5 },
    ];
    const result = moveItem(dup, "a", 1);
    expect(new Set(result.map((r) => r.sort_order)).size).toBe(3);
  });
});

describe("errorMessage", () => {
  it("translates database rules into plain language", () => {
    expect(
      errorMessage({
        message: 'duplicate key value violates unique constraint "products_sku_lower_key"',
      }),
    ).toMatch(/SKU/);
    expect(
      errorMessage({
        message: 'new row violates check constraint "products_old_price_above_price"',
      }),
    ).toMatch(/preço antigo/);
    expect(
      errorMessage({ message: 'new row violates row-level security policy for table "brands"' }),
    ).toMatch(/permissão/);
  });
  it("accepts Error instances, plain objects and unknown values", () => {
    expect(errorMessage(new Error("falhou"))).toBe("falhou");
    expect(errorMessage({ message: "do banco" })).toBe("do banco");
    expect(errorMessage(undefined)).toBe("Erro inesperado.");
  });
});

describe("validateProductForm (same rules as the database)", () => {
  const ok = {
    name: "Pistão",
    slug: "",
    sku: "PIS-001",
    brand_id: "",
    category_id: "",
    price: "100",
    old_price: "",
    description: "",
    sizes: "",
    colors: "",
    stock_status: "in_stock",
    active: true,
    featured: false,
    is_new: false,
  };
  it("accepts a valid form, and a blank slug (generated from the name)", () => {
    expect(validateProductForm(ok)).toBeNull();
    expect(validateProductForm({ ...ok, sku: "" })).toBeNull();
  });
  it("requires a name", () => expect(validateProductForm({ ...ok, name: "  " })).toMatch(/nome/i));
  it("checks the slug format", () =>
    expect(validateProductForm({ ...ok, slug: "Slug Ruim" })).toMatch(/slug/i));
  it("checks the SKU format", () => {
    expect(validateProductForm({ ...ok, sku: "x" })).toMatch(/SKU/);
    expect(validateProductForm({ ...ok, sku: "tem espaço" })).toMatch(/SKU/);
    expect(validateProductForm({ ...ok, sku: "A".repeat(41) })).toMatch(/SKU/);
  });
  it("rejects a negative price and an old price that is not higher", () => {
    expect(validateProductForm({ ...ok, price: "-1" })).toMatch(/negativo/);
    expect(validateProductForm({ ...ok, old_price: "100" })).toMatch(/antigo/);
    expect(validateProductForm({ ...ok, old_price: "50" })).toMatch(/antigo/);
    expect(validateProductForm({ ...ok, old_price: "150" })).toBeNull();
  });
});
