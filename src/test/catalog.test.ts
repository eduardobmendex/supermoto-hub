import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogSearchSchema, groupFitments, sanitizeTerm } from "@/modules/catalog/catalog";
import { SECTORS, sectorByKey } from "@/modules/catalog/sectors";

describe("sectors", () => {
  it("has the nine APEX sectors with unique keys and codes", () => {
    expect(SECTORS).toHaveLength(9);
    expect(new Set(SECTORS.map((s) => s.key)).size).toBe(9);
    expect(SECTORS.map((s) => s.code)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
    ]);
  });

  it("uses URL-safe slugs", () => {
    for (const s of SECTORS) expect(s.key).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("matches the categories created by docs/apex-sectors.sql, slug by slug", () => {
    const sql = readFileSync("docs/apex-sectors.sql", "utf8");
    const slugs = [...sql.matchAll(/^\s*\('[^']+',\s*'([a-z-]+)',\s*\d+\)/gm)].map((m) => m[1]);
    expect(slugs).toEqual(SECTORS.map((s) => s.key));
  });

  it("finds a sector by key", () => {
    expect(sectorByKey("braking-system")?.name).toBe("Braking System");
    expect(sectorByKey("nope")).toBeUndefined();
    expect(sectorByKey(undefined)).toBeUndefined();
  });
});

describe("sanitizeTerm", () => {
  it("removes characters that change a PostgREST filter or an ilike pattern", () => {
    expect(sanitizeTerm("a,b(c)%_*\\")).toBe("a b c");
    expect(sanitizeTerm("  disco   de  freio ")).toBe("disco de freio");
  });

  it("keeps accents and digits", () => {
    expect(sanitizeTerm("pistão 54 mm")).toBe("pistão 54 mm");
  });

  it("can end up empty, which means no text filter", () => {
    expect(sanitizeTerm(",,,%%")).toBe("");
  });
});

describe("catalogSearchSchema", () => {
  const parse = (input: unknown) => catalogSearchSchema.parse(input);

  it("accepts a full valid search", () => {
    expect(
      parse({
        q: " disco ",
        setor: "braking-system",
        ordem: "preco-asc",
        disponiveis: true,
        pagina: 2,
      }),
    ).toEqual({
      q: "disco",
      setor: "braking-system",
      ordem: "preco-asc",
      disponiveis: true,
      pagina: 2,
    });
  });

  it("falls back to undefined instead of throwing on bad values", () => {
    expect(parse({ ordem: "xxx", pagina: "abc", disponiveis: "maybe", q: 42 })).toEqual({});
    expect(parse({ pagina: 0 })).toEqual({});
    expect(parse({ pagina: 1.5 })).toEqual({});
    expect(parse({ setor: "x".repeat(200) })).toEqual({});
    expect(parse({ q: "y".repeat(200) })).toEqual({});
  });

  it("accepts an empty search", () => {
    expect(parse({})).toEqual({});
  });
});

describe("groupFitments", () => {
  const f = (
    label: string,
    year: number,
    extra: Partial<{ position: string; restrictions: string; notes: string }> = {},
  ) => ({
    label,
    year,
    position: "",
    restrictions: "",
    notes: "",
    ...extra,
  });

  it("joins the years of the same motorcycle and application, in order", () => {
    const groups = groupFitments([
      f("Honda CG 160 Fan", 2025),
      f("Honda CG 160 Fan", 2023),
      f("Honda CG 160 Fan", 2024),
    ]);
    expect(groups).toEqual([
      {
        label: "Honda CG 160 Fan",
        years: [2023, 2024, 2025],
        position: "",
        restrictions: "",
        notes: "",
      },
    ]);
  });

  it("keeps different positions or restrictions apart", () => {
    const groups = groupFitments([
      f("Honda CG 160 Fan", 2025, { position: "dianteiro" }),
      f("Honda CG 160 Fan", 2025, { position: "traseiro" }),
      f("Honda CG 160 Fan", 2025, { restrictions: "Somente com ABS" }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("does not repeat a year", () => {
    expect(
      groupFitments([f("Yamaha Fazer 250", 2024), f("Yamaha Fazer 250", 2024)])[0]!.years,
    ).toEqual([2024]);
  });

  it("returns nothing when there is no validated application", () => {
    expect(groupFitments([])).toEqual([]);
  });
});
