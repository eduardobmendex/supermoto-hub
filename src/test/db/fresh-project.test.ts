// @vitest-environment node
/**
 * Simula o projeto Supabase NOVO e VAZIO: roda, em ordem, os quatro arquivos que o usuário cola no
 * SQL Editor (setup-base, apex-sectors, schema, seed-demo-products) e confere o resultado.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const file = (name: string) => readFileSync(`docs/${name}`, "utf8");
const ORDER = ["setup-base.sql", "apex-sectors.sql", "schema.sql", "seed-demo-products.sql"];
const OWNER = "00000000-0000-4000-8000-0000000000b1";
const STRANGER = "00000000-0000-4000-8000-0000000000b2";

let db: PGlite;
const rows = async (sql: string) => (await db.query(sql)).rows as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

async function as<T>(role: "anon" | "authenticated", uid: string, fn: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    await db.exec(`set local role ${role}`);
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

beforeAll(async () => {
  db = new PGlite();
  // O que o Supabase já traz de fábrica num projeto vazio.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
    create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const f of ORDER) await db.exec(file(f));
  // O dono se cadastra primeiro; depois um estranho.
  await db.exec(`insert into auth.users (id) values ('${OWNER}'), ('${STRANGER}')`);
}, 120_000);

afterEach(async () => {
  await db.exec("rollback").catch(() => {});
});

describe("projeto novo, do zero", () => {
  it("cria todas as tabelas do catálogo APEX", async () => {
    const names = (
      await rows(`select table_name from information_schema.tables where table_schema = 'public'`)
    ).map((r) => r.table_name);
    for (const t of [
      "user_roles",
      "categories",
      "products",
      "store_settings",
      "brands",
      "motorcycles",
      "motorcycle_versions",
      "product_variants",
      "product_specs",
      "inventory",
      "product_media",
      "product_experiences",
      "product_fitments",
      "profiles",
    ]) {
      expect(names, t).toContain(t);
    }
  });

  it("não traz dados da loja anterior: só os 9 setores e os 5 produtos DEMO", async () => {
    expect(
      (await rows(`select slug from public.categories order by sort_order`)).map((r) => r.slug),
    ).toEqual([
      "engine-power",
      "braking-system",
      "suspension-control",
      "wheels-tires",
      "transmission",
      "exhaust-performance",
      "design-accessories",
      "helmets-protection",
      "electrical-system",
    ]);
    const products = await rows(`select name, is_demo from public.products`);
    expect(products).toHaveLength(5);
    expect(products.every((p) => p.is_demo && p.name.startsWith("[DEMO]"))).toBe(true);
  });

  it("a loja nasce APEX, sem WhatsApp de exemplo", async () => {
    const [s] = await rows(`select * from public.store_settings`);
    expect(s).toMatchObject({
      id: 1,
      store_name: "APEX",
      whatsapp: "",
      address: null,
      hours: null,
    });
    expect(s.banner_title).not.toMatch(/supermotos/i);
  });

  it("o primeiro usuário vira administrador e o seguinte não", async () => {
    expect(await rows(`select user_id, role from public.user_roles`)).toEqual([
      { user_id: OWNER, role: "admin" },
    ]);
    expect((await rows(`select id from public.profiles order by id`)).map((r) => r.id)).toEqual([
      OWNER,
      STRANGER,
    ]);
  });

  it("cria o bucket de arquivos como privado, com as quatro políticas", async () => {
    expect(await rows(`select id, public from storage.buckets`)).toEqual([
      { id: "products", public: false },
    ]);
    const policies = (
      await rows(
        `select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'`,
      )
    )
      .map((r) => r.policyname)
      .sort();
    expect(policies).toEqual([
      "admin delete products files",
      "admin insert products files",
      "admin update products files",
      "public read products files",
    ]);
  });

  it("visitante lê a loja e não escreve; só o dono administra", async () => {
    await as("anon", "", async () => {
      expect((await rows(`select 1 from public.categories`)).length).toBe(9);
      expect((await rows(`select 1 from public.store_settings`)).length).toBe(1);
      expect((await rows(`select 1 from public.products`)).length).toBe(0); // demos inativos
      await expect(
        db.query(`insert into public.categories (name, slug) values ('x', 'x')`),
      ).rejects.toThrow(/permission denied/);
    });
    await as("authenticated", STRANGER, async () => {
      await expect(
        db.query(`insert into public.categories (name, slug) values ('x', 'x')`),
      ).rejects.toThrow(/row-level security/);
    });
    await as("authenticated", OWNER, async () => {
      await db.query(`update public.store_settings set whatsapp = '5511900000000'`);
      expect((await rows(`select 1 from public.products`)).length).toBe(5); // o dono vê os inativos
    });
  });

  it("pode rodar os quatro arquivos de novo sem duplicar nada", async () => {
    const snapshot = () =>
      rows(
        `select (select count(*) from public.categories) c, (select count(*) from public.products) p, (select count(*) from public.user_roles) r, (select count(*) from public.profiles) f, (select count(*) from public.product_experiences) e, (select count(*) from storage.buckets) b`,
      );
    const before = await snapshot();
    for (const f of ORDER) await db.exec(file(f));
    expect(await snapshot()).toEqual(before);
  });
});
