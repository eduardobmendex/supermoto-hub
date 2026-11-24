// @vitest-environment node
/**
 * Roda docs/schema.sql sobre as migrations REAIS do projeto, num Postgres de verdade (PGlite), e testa
 * estrutura, restrições, gatilhos e as políticas de RLS para cada tipo de usuário.
 * O Supabase é simulado só no que ele fornece de fora do SQL: os papéis, o schema auth e auth.uid().
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(path, "utf8");
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const USER = "00000000-0000-4000-8000-0000000000a2";
const USER2 = "00000000-0000-4000-8000-0000000000a3";

type Who = "anon" | "user" | "admin" | "service";
// Linhas de consultas SQL arbitrárias: os campos mudam a cada teste, então o tipo é dinâmico de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Q = (sql: string, params?: unknown[]) => Promise<Row[]>;

let db: PGlite;
const su: Q = async (sql, params) => (await db.query(sql, params as never)).rows as never;

/** Executa como um papel do Supabase. Sempre desfaz no fim, para os testes não interferirem entre si. */
async function as<T>(who: Who, fn: (q: Q, root: Q) => Promise<T>): Promise<T> {
  const role = {
    anon: "anon",
    user: "authenticated",
    admin: "authenticated",
    service: "service_role",
  }[who];
  const uid = { anon: "", user: USER, admin: ADMIN, service: "" }[who];
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    await db.exec(`set local role ${role}`);
    // "root" consulta como dono do banco, no meio da transação do papel restrito, para conferir o efeito real de uma escrita.
    const root: Q = async (sql, params) => {
      await db.exec("reset role");
      try {
        return await su(sql, params);
      } finally {
        await db.exec(`set local role ${role}`);
      }
    };
    return await fn(su, root);
  } finally {
    await db.exec("rollback");
  }
}

const denied =
  /permission denied|row-level security|violates|check constraint|duplicate key|invalid input|não pode ser habilitada|não é fabricante|foreign key/i;
const rejects = (p: Promise<unknown>, re: RegExp = denied) => expect(p).rejects.toThrow(re);
/** Para um erro esperado no meio de uma transação: usa savepoint, senão o erro abortaria o restante. */
async function fails(sql: string, re: RegExp = denied) {
  await db.exec("savepoint expected_error");
  try {
    await su(sql);
  } catch (e) {
    await db.exec("rollback to savepoint expected_error");
    expect((e as Error).message).toMatch(re);
    return;
  }
  throw new Error(`Era esperado falhar, mas passou: ${sql}`);
}
const idOf = async (table: string, col: string, val: string) =>
  (await su(`select id from public.${table} where ${col} = $1`, [val]))[0]!.id as string;
const count = async (q: Q, sql: string, params?: unknown[]) => (await q(sql, params)).length;

const ids = {} as {
  ativo: string;
  inativo: string;
  v2025: string;
  v2024: string;
  vInativa: string;
};

// Uma falha no meio de uma transação deixaria as seguintes abortadas: sempre volta ao estado limpo.
afterEach(async () => {
  await db.exec("rollback").catch(() => {});
});

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.objects (bucket_id text, name text);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(file("drizzle/migrations/0000_supermotos_schema.sql"));
  await db.exec(file("drizzle/migrations/0001_products_storage_policies.sql"));
  // O primeiro usuário vira admin (gatilho da migration 0000). Os dois primeiros existem ANTES do schema novo,
  // para testar a cópia dos perfis; o terceiro depois, para testar o gatilho.
  await db.exec(`insert into auth.users (id) values ('${ADMIN}'), ('${USER}')`);
  // Dados antigos, no formato que o painel atual grava, para testar a cópia para as tabelas novas.
  await db.exec(`
    update public.products set images = array['https://x/a.jpg', 'https://x/b.jpg'] where slug = 'capacete-apex-carbon';
    update public.products set images = array['https://x/c.jpg'] where slug = 'luva-racer-pro';
  `);
  // SCHEMA_FILE existe só para o teste de mutação: apontar para uma cópia propositalmente quebrada deve fazer a suíte falhar.
  await db.exec(file(process.env["SCHEMA_FILE"] ?? "docs/schema.sql"));
  await db.exec(`insert into auth.users (id) values ('${USER2}')`);
  await db.exec(file("docs/apex-sectors.sql"));

  // Fixture: dois produtos (um ativo, um inativo), motos e compatibilidades.
  await db.exec(`
    insert into public.brands (name, slug, kind) values ('Honda', 'honda', 'motorcycle'), ('Yamaha', 'yamaha', 'motorcycle'), ('Acme', 'acme', 'part'), ('Both', 'both', 'both');
    insert into public.products (name, slug, sku, price, active, category_id) values
      ('Produto ativo', 'p-ativo', 'SKU-001', 100, true, (select id from public.categories where slug = 'engine-power')),
      ('Produto inativo', 'p-inativo', 'SKU-002', 100, false, (select id from public.categories where slug = 'engine-power'));
    insert into public.motorcycles (brand_id, model, slug, displacement_cc, active) values
      ((select id from public.brands where slug = 'honda'), 'CG 160 Fan', 'honda-cg-160-fan', 160, true),
      ((select id from public.brands where slug = 'yamaha'), 'Moto desativada', 'yamaha-desativada', 125, false);
    insert into public.motorcycle_versions (motorcycle_id, year, version) values
      ((select id from public.motorcycles where slug = 'honda-cg-160-fan'), 2025, 'Padrão'),
      ((select id from public.motorcycles where slug = 'honda-cg-160-fan'), 2024, 'Fan'),
      ((select id from public.motorcycles where slug = 'yamaha-desativada'), 2025, 'Padrão');
  `);
  for (const [k, t, c, v] of [
    ["ativo", "products", "slug", "p-ativo"],
    ["inativo", "products", "slug", "p-inativo"],
  ] as const)
    ids[k] = await idOf(t, c, v);
  ids.v2025 = (
    await su(
      `select v.id from public.motorcycle_versions v join public.motorcycles m on m.id = v.motorcycle_id where m.slug = 'honda-cg-160-fan' and v.year = 2025`,
    )
  )[0]!.id;
  ids.v2024 = (
    await su(
      `select v.id from public.motorcycle_versions v join public.motorcycles m on m.id = v.motorcycle_id where m.slug = 'honda-cg-160-fan' and v.year = 2024`,
    )
  )[0]!.id;
  ids.vInativa = (
    await su(
      `select v.id from public.motorcycle_versions v join public.motorcycles m on m.id = v.motorcycle_id where m.slug = 'yamaha-desativada'`,
    )
  )[0]!.id;

  const children = (p: string, tag: string) => `
    insert into public.product_variants (product_id, sku, name, active) values ('${p}', 'V-${tag}-ON', 'Variação ativa ${tag}', true), ('${p}', 'V-${tag}-OFF', 'Variação inativa ${tag}', false);
    insert into public.product_specs (product_id, label, value) values ('${p}', 'Material', 'Aço ${tag}');
    insert into public.product_media (product_id, kind, url, is_primary) values ('${p}', 'image', 'https://x/${tag}.jpg', true);
    insert into public.inventory (product_id, quantity) values ('${p}', ${tag === "ativo" ? 5 : 0});`;
  await db.exec(children(ids.ativo!, "ativo") + children(ids.inativo!, "inativo"));
  await db.exec(`
    update public.product_experiences set enabled = true where product_id in ('${ids.ativo}', '${ids.inativo}');
    insert into public.product_fitments (product_id, motorcycle_version_id, validated) values
      ('${ids.ativo}', '${ids.v2025}', true),
      ('${ids.ativo}', '${ids.v2024}', false),
      ('${ids.inativo}', '${ids.v2025}', true),
      ('${ids.ativo}', '${ids.vInativa}', true);
  `);
}, 120_000);

describe("estrutura", () => {
  it("cria as 12 entidades pedidas", async () => {
    const rows = await su(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = rows.map((r) => r.table_name);
    for (const t of [
      "brands",
      "motorcycles",
      "motorcycle_versions",
      "categories",
      "products",
      "product_variants",
      "product_fitments",
      "product_media",
      "product_experiences",
      "product_specs",
      "inventory",
      "profiles",
    ]) {
      expect(names, t).toContain(t);
    }
  });

  it("liga o RLS em todas as tabelas novas", async () => {
    const rows = await su(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    const off = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
    expect(off).toEqual([]);
  });

  it("pode ser aplicado de novo sem erro e sem duplicar nada", async () => {
    const before = await su(
      `select (select count(*) from public.brands) b, (select count(*) from public.product_media) m, (select count(*) from public.product_specs) s, (select count(*) from public.product_experiences) e, (select count(*) from public.profiles) p`,
    );
    await db.exec(file("docs/schema.sql"));
    const after = await su(
      `select (select count(*) from public.brands) b, (select count(*) from public.product_media) m, (select count(*) from public.product_specs) s, (select count(*) from public.product_experiences) e, (select count(*) from public.profiles) p`,
    );
    expect(after).toEqual(before);
  });

  it("não apaga nenhuma coluna que o site atual lê", async () => {
    const cols = (
      await su(`select column_name from information_schema.columns where table_name = 'products'`)
    ).map((r) => r.column_name);
    for (const c of [
      "images",
      "specs",
      "brand",
      "stock_status",
      "model_url",
      "model_status",
      "price",
      "old_price",
      "slug",
      "active",
      "featured",
      "is_new",
    ])
      expect(cols).toContain(c);
  });
});

describe("migração dos dados que já existiam", () => {
  it("cria as marcas a partir do texto antigo e liga os produtos", async () => {
    const brands = (
      await su(`select name from public.brands where kind = 'part' order by name`)
    ).map((r) => r.name);
    expect(brands).toEqual(expect.arrayContaining(["Apex", "Racer", "Storm", "Trail"]));
    const unlinked = await su(
      `select name from public.products where brand <> '' and brand_id is null and is_demo = false and slug not like 'p-%'`,
    );
    expect(unlinked).toEqual([]);
  });

  it("copia as fotos, com a primeira como principal", async () => {
    const rows = await su(
      `select url, is_primary, sort_order from public.product_media m join public.products p on p.id = m.product_id where p.slug = 'capacete-apex-carbon' order by sort_order`,
    );
    expect(rows).toEqual([
      { url: "https://x/a.jpg", is_primary: true, sort_order: 0 },
      { url: "https://x/b.jpg", is_primary: false, sort_order: 1 },
    ]);
  });

  it("copia as especificações", async () => {
    const rows = await su(
      `select label, value from public.product_specs s join public.products p on p.id = s.product_id where p.slug = 'capacete-apex-carbon' order by sort_order`,
    );
    expect(rows.map((r) => r.label)).toEqual(["Material", "Peso", "Certificação"]);
  });

  it("dá uma experiência a cada produto e só habilita a que tem imagem", async () => {
    const rows = await su(
      `select p.slug, e.enabled from public.products p join public.product_experiences e on e.product_id = p.id where p.slug in ('capacete-apex-carbon', 'bota-trail-x')`,
    );
    expect(Object.fromEntries(rows.map((r) => [r.slug, r.enabled]))).toEqual({
      "capacete-apex-carbon": true,
      "bota-trail-x": false,
    });
  });

  it("mantém products.stock_status e as consultas atuais do site funcionando", async () => {
    const rows = await as("anon", (q) =>
      q(`select * from public.products where active order by created_at desc`),
    );
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0]).toHaveProperty("images");
  });
});

describe("restrições dos produtos", () => {
  const bad = (set: string) => su(`update public.products set ${set} where slug = 'p-ativo'`);
  it("rejeita preço negativo, preço antigo menor, slug e SKU inválidos, estoque inválido", async () => {
    await rejects(bad("price = -1"));
    await rejects(bad("old_price = 50"));
    await rejects(bad("slug = 'Slug Inválido'"));
    await rejects(bad("sku = 'x'"));
    await rejects(bad("stock_status = 'talvez'"));
  });
  it("não deixa dois produtos com o mesmo SKU, ignorando maiúsculas", async () => {
    await rejects(su(`update public.products set sku = 'sku-001' where slug = 'p-inativo'`));
  });
  it("sincroniza o nome da marca ao escolher brand_id", async () => {
    await db.exec("begin");
    await su(
      `update public.products set brand_id = (select id from public.brands where slug = 'acme') where slug = 'p-ativo'`,
    );
    expect((await su(`select brand from public.products where slug = 'p-ativo'`))[0]!.brand).toBe(
      "Acme",
    );
    await db.exec("rollback");
  });
});

describe("variações, estoque e mídia", () => {
  it("variação: SKU único (sem diferenciar caixa) e atributos devem ser um objeto", async () => {
    await rejects(
      su(
        `insert into public.product_variants (product_id, sku, name) values ('${ids.inativo}', 'v-ativo-on', 'x')`,
      ),
    );
    await rejects(
      su(
        `insert into public.product_variants (product_id, sku, name, attributes) values ('${ids.ativo}', 'NOVO-1', 'x', '[]')`,
      ),
    );
    await rejects(
      su(
        `insert into public.product_variants (product_id, sku, name, price) values ('${ids.ativo}', 'NOVO-2', 'x', -5)`,
      ),
    );
  });

  it("estoque: sem quantidade negativa, um registro por alvo, variação tem de ser do produto", async () => {
    await rejects(
      su(`update public.inventory set quantity = -1 where product_id = '${ids.ativo}'`),
    );
    await rejects(
      su(`insert into public.inventory (product_id, quantity) values ('${ids.ativo}', 1)`),
    );
    const other = (
      await su(`select id from public.product_variants where sku = 'V-inativo-ON'`)
    )[0]!.id;
    await rejects(
      su(
        `insert into public.inventory (product_id, variant_id, quantity) values ('${ids.ativo}', '${other}', 1)`,
      ),
    );
  });

  it("estoque: products.stock_status acompanha a quantidade", async () => {
    await db.exec("begin");
    await su(`update public.inventory set quantity = 0 where product_id = '${ids.ativo}'`);
    expect(
      (await su(`select stock_status from public.products where id = '${ids.ativo}'`))[0]!
        .stock_status,
    ).toBe("out_of_stock");
    await su(`update public.inventory set quantity = 3 where product_id = '${ids.ativo}'`);
    expect(
      (await su(`select stock_status from public.products where id = '${ids.ativo}'`))[0]!
        .stock_status,
    ).toBe("in_stock");
    await su(`delete from public.inventory where product_id = '${ids.ativo}'`);
    expect(
      (await su(`select stock_status from public.products where id = '${ids.ativo}'`))[0]!
        .stock_status,
    ).toBe("out_of_stock");
    await db.exec("rollback");
  });

  it("mídia: valida origem, sequência 360°, imagem principal e duplicidade", async () => {
    const ins = (cols: string, vals: string) =>
      su(`insert into public.product_media (product_id, ${cols}) values ('${ids.ativo}', ${vals})`);
    await rejects(ins("kind", `'image'`)); // sem url nem caminho
    await rejects(ins("kind, url", `'frame_360', 'https://x/f.jpg'`)); // quadro sem índice
    await rejects(ins("kind, url, sequence_index", `'image', 'https://x/f.jpg', 0`)); // imagem com índice
    await rejects(ins("kind, url, is_primary", `'image', 'https://x/p2.jpg', true`)); // segunda principal
    await rejects(ins("kind, url, is_primary", `'model_glb', 'https://x/m.glb', true`)); // principal que não é imagem
    await db.exec("begin");
    await ins("kind, url, sequence_index", `'frame_360', 'https://x/f0.jpg', 0`);
    await rejects(ins("kind, url, sequence_index", `'frame_360', 'https://x/f0b.jpg', 0`)); // índice repetido
    await db.exec("rollback");
  });
});

describe("experiências do produto", () => {
  const setup = async (type: string, config = "{}") => {
    await su(
      `update public.product_experiences set type = '${type}', config = '${config}'::jsonb, enabled = false where product_id = '${ids.ativo}'`,
    );
  };
  // Montado na hora do uso: os ids só existem depois do beforeAll.
  const enableSql = () =>
    `update public.product_experiences set enabled = true where product_id = '${ids.ativo}'`;
  const enable = () => su(enableSql());
  const addFrames = async (n: number, skip = -1) => {
    for (let i = 0; i < n; i++)
      if (i !== skip)
        await su(
          `insert into public.product_media (product_id, kind, url, sequence_index) values ('${ids.ativo}', 'frame_360', 'https://x/f${i}.jpg', ${i})`,
        );
  };
  const addModel = () =>
    su(
      `insert into public.product_media (product_id, kind, url) values ('${ids.ativo}', 'model_glb', 'https://x/m.glb')`,
    );

  it("só habilita 'standard' com pelo menos uma imagem", async () => {
    await db.exec("begin");
    await su(`delete from public.product_media where product_id = '${ids.ativo}'`);
    await setup("standard");
    await fails(enableSql(), /pelo menos 1 imagem/);
    await su(
      `insert into public.product_media (product_id, kind, url) values ('${ids.ativo}', 'image', 'https://x/a.jpg')`,
    );
    await enable();
    await db.exec("rollback");
  });

  it("exige 12 quadros em sequência contínua para 360°", async () => {
    await db.exec("begin");
    await setup("image_360");
    await addFrames(11);
    await fails(enableSql(), /pelo menos 12 quadros/);
    await db.exec("rollback");
    await db.exec("begin");
    await setup("image_360");
    await addFrames(13, 5); // 12 quadros, mas falta o índice 5
    await fails(enableSql(), /sem lacunas/);
    await db.exec("rollback");
    await db.exec("begin");
    await setup("image_360");
    await addFrames(12);
    await enable();
    await db.exec("rollback");
  });

  it("exige modelo para 3D, e lista de peças para vista explodida", async () => {
    await db.exec("begin");
    await setup("interactive_3d");
    await fails(enableSql(), /modelo GLB\/GLTF/);
    await addModel();
    await enable();
    await setup("exploded");
    await fails(enableSql(), /config\.parts/);
    await setup("exploded", `{"parts": [{"id": "a"}]}`);
    await enable();
    await db.exec("rollback");
  });

  it("exige opções para o configurador e imagem 'instalado' para a vista instalada", async () => {
    await db.exec("begin");
    await addModel();
    await setup("configurator");
    await fails(enableSql(), /config\.options/);
    await setup("configurator", `{"options": [{"id": "cor"}]}`);
    await enable();
    await setup("installed");
    await fails(enableSql(), /instalado/);
    await su(
      `insert into public.product_media (product_id, kind, url, meta) values ('${ids.ativo}', 'image', 'https://x/i.jpg', '{"role": "installed"}')`,
    );
    await enable();
    await db.exec("rollback");
  });

  it("desabilita sozinha a experiência quando um arquivo necessário é removido", async () => {
    await db.exec("begin");
    await setup("image_360");
    await addFrames(12);
    await enable();
    await su(
      `delete from public.product_media where product_id = '${ids.ativo}' and sequence_index = 3`,
    );
    expect(
      (
        await su(`select enabled from public.product_experiences where product_id = '${ids.ativo}'`)
      )[0]!.enabled,
    ).toBe(false);
    await db.exec("rollback");
  });

  it("produto novo ganha a experiência padrão, desabilitada", async () => {
    await db.exec("begin");
    await su(`insert into public.products (name, slug, price) values ('Novo', 'novo-produto', 10)`);
    const row = (
      await su(
        `select e.type, e.enabled from public.product_experiences e join public.products p on p.id = e.product_id where p.slug = 'novo-produto'`,
      )
    )[0]!;
    expect(row).toEqual({ type: "standard", enabled: false });
    await db.exec("rollback");
  });

  it("um produto só tem uma experiência", async () => {
    await rejects(
      su(`insert into public.product_experiences (product_id) values ('${ids.ativo}')`),
    );
  });
});

describe("motocicletas e compatibilidade", () => {
  it("só aceita fabricante de motocicletas como marca da moto", async () => {
    await rejects(
      su(
        `insert into public.motorcycles (brand_id, model, slug) values ((select id from public.brands where slug = 'acme'), 'Moto X', 'acme-moto-x')`,
      ),
      /não é fabricante/,
    );
    await db.exec("begin");
    await su(
      `insert into public.motorcycles (brand_id, model, slug) values ((select id from public.brands where slug = 'both'), 'Moto Y', 'both-moto-y')`,
    );
    await db.exec("rollback");
  });

  it("rejeita modelo repetido (sem diferenciar caixa), cilindrada e ano absurdos, versão repetida", async () => {
    await rejects(
      su(
        `insert into public.motorcycles (brand_id, model, slug) values ((select id from public.brands where slug = 'honda'), 'cg 160 fan', 'outro')`,
      ),
    );
    await rejects(
      su(`update public.motorcycles set displacement_cc = 0 where slug = 'honda-cg-160-fan'`),
    );
    await rejects(
      su(
        `insert into public.motorcycle_versions (motorcycle_id, year) values ((select id from public.motorcycles where slug = 'honda-cg-160-fan'), 1900)`,
      ),
    );
    await rejects(
      su(
        `insert into public.motorcycle_versions (motorcycle_id, year, version) values ((select id from public.motorcycles where slug = 'honda-cg-160-fan'), 2025, 'Padrão')`,
      ),
    );
  });

  it("não apaga uma marca que ainda tem motos", async () => {
    await rejects(su(`delete from public.brands where slug = 'honda'`));
  });

  it("um produto serve em várias motos e uma moto aceita vários produtos", async () => {
    const rows = await su(
      `select count(distinct motorcycle_version_id) v from public.product_fitments where product_id = '${ids.ativo}'`,
    );
    expect(Number(rows[0]!.v)).toBe(3);
  });

  it("carimba quem validou e quando, e remove o carimbo ao invalidar", async () => {
    const row = await as("admin", async (q) => {
      await q(
        `insert into public.product_fitments (product_id, motorcycle_version_id, position, validated) values ('${ids.ativo}', '${ids.v2025}', 'traseiro', true)`,
      );
      return (
        await q(
          `select validated_by, validated_at from public.product_fitments where position = 'traseiro'`,
        )
      )[0]!;
    });
    expect(row.validated_by).toBe(ADMIN);
    expect(row.validated_at).not.toBeNull();
    await db.exec("begin");
    await su(
      `update public.product_fitments set validated = false where product_id = '${ids.ativo}' and motorcycle_version_id = '${ids.v2025}' and position = ''`,
    );
    const off = (
      await su(
        `select validated, validated_at, validated_by from public.product_fitments where product_id = '${ids.ativo}' and motorcycle_version_id = '${ids.v2025}' and position = ''`,
      )
    )[0]!;
    expect(off).toEqual({ validated: false, validated_at: null, validated_by: null });
    await db.exec("rollback");
  });

  it("alterar a aplicação de uma compatibilidade validada exige validar de novo", async () => {
    await db.exec("begin");
    await su(
      `update public.product_fitments set restrictions = 'Somente com ABS' where product_id = '${ids.ativo}' and motorcycle_version_id = '${ids.v2025}'`,
    );
    const row = (
      await su(
        `select validated, validated_at from public.product_fitments where product_id = '${ids.ativo}' and motorcycle_version_id = '${ids.v2025}'`,
      )
    )[0]!;
    expect(row).toEqual({ validated: false, validated_at: null });
    await db.exec("rollback");
  });

  it("não repete a mesma aplicação (produto, versão e posição)", async () => {
    await rejects(
      su(
        `insert into public.product_fitments (product_id, motorcycle_version_id) values ('${ids.ativo}', '${ids.v2025}')`,
      ),
    );
  });
});

describe("perfis", () => {
  it("cria o perfil de quem já existia e de quem se cadastra depois", async () => {
    const rows = (await su(`select id from public.profiles`)).map((r) => r.id);
    expect(rows).toEqual(expect.arrayContaining([ADMIN, USER, USER2]));
  });

  it("o primeiro usuário continua virando administrador", async () => {
    const roles = await su(`select user_id, role from public.user_roles`);
    expect(roles).toEqual([{ user_id: ADMIN, role: "admin" }]);
  });
});

describe("RLS: visitante (anon)", () => {
  it("lê marcas, motos ativas e versões de motos ativas", async () => {
    await as("anon", async (q) => {
      expect((await q(`select 1 from public.brands`)).length).toBeGreaterThanOrEqual(4);
      expect((await q(`select slug from public.motorcycles`)).map((r) => r.slug)).toEqual([
        "honda-cg-160-fan",
      ]);
      expect((await q(`select 1 from public.motorcycle_versions`)).length).toBe(2);
    });
  });

  it("vê os dados do produto ativo e nada do produto inativo", async () => {
    await as("anon", async (q) => {
      expect(
        await count(q, `select 1 from public.product_specs where product_id = '${ids.ativo}'`),
      ).toBe(1);
      expect(
        await count(q, `select 1 from public.product_specs where product_id = '${ids.inativo}'`),
      ).toBe(0);
      expect(
        await count(q, `select 1 from public.product_media where product_id = '${ids.inativo}'`),
      ).toBe(0);
      expect(
        await count(q, `select 1 from public.product_media where product_id = '${ids.ativo}'`),
      ).toBe(1);
      expect(
        await count(
          q,
          `select 1 from public.product_experiences where product_id = '${ids.inativo}'`,
        ),
      ).toBe(0);
    });
  });

  it("não vê variações inativas nem experiências desabilitadas", async () => {
    await as("anon", async (q) => {
      expect((await q(`select sku from public.product_variants`)).map((r) => r.sku)).toEqual([
        "V-ativo-ON",
      ]);
      expect(
        await count(q, `select 1 from public.product_variants where sku = 'V-ativo-OFF'`),
      ).toBe(0);
    });
    await su(
      `update public.product_experiences set enabled = false where product_id = '${ids.ativo}'`,
    );
    await as("anon", async (q) =>
      expect(
        await count(
          q,
          `select 1 from public.product_experiences where product_id = '${ids.ativo}'`,
        ),
      ).toBe(0),
    );
    await su(
      `update public.product_experiences set enabled = true where product_id = '${ids.ativo}'`,
    );
  });

  it("só vê compatibilidade validada, de produto ativo e de moto ativa", async () => {
    await as("anon", async (q) => {
      const rows = await q(
        `select motorcycle_version_id v, validated from public.product_fitments`,
      );
      expect(rows).toEqual([{ v: ids.v2025, validated: true }]);
    });
  });

  it("não acessa o estoque exato, só a situação 'tem ou não tem'", async () => {
    await as("anon", async (q) => {
      await rejects(q(`select quantity from public.inventory`), /permission denied/);
    });
    await as("anon", async (q) => {
      const rows = await q(`select * from public.product_stock_status`);
      expect(rows).toEqual([{ product_id: ids.ativo, variant_id: null, in_stock: true }]);
      expect(Object.keys(rows[0]!)).not.toContain("quantity");
    });
  });

  it("não lê perfis e não escreve em nenhuma tabela", async () => {
    await as("anon", async (q) => rejects(q(`select * from public.profiles`), /permission denied/));
    for (const sql of [
      `insert into public.brands (name, slug) values ('Hack', 'hack')`,
      `update public.product_specs set value = 'x'`,
      `delete from public.product_media`,
      `insert into public.product_fitments (product_id, motorcycle_version_id, validated) values ('${ids.ativo}', '${ids.v2024}', true)`,
      `update public.inventory set quantity = 999`,
      `insert into public.user_roles (user_id, role) values ('${USER}', 'admin')`,
    ])
      await as("anon", async (q) => rejects(q(sql), /permission denied/));
  });
});

describe("RLS: cliente logado (não administrador)", () => {
  it("lê o mesmo que o visitante", async () => {
    await as("user", async (q) => {
      expect(
        await count(q, `select 1 from public.product_specs where product_id = '${ids.ativo}'`),
      ).toBe(1);
      expect(
        await count(q, `select 1 from public.product_specs where product_id = '${ids.inativo}'`),
      ).toBe(0);
      expect(await count(q, `select 1 from public.product_fitments`)).toBe(1);
      expect((await q(`select 1 from public.motorcycles`)).length).toBe(1);
    });
  });

  it("enxerga zero linhas de estoque (não há política para ele)", async () => {
    await as("user", async (q) => expect(await count(q, `select 1 from public.inventory`)).toBe(0));
  });

  it("não escreve no catálogo, nem se promove a administrador", async () => {
    const writes = [
      `insert into public.brands (name, slug) values ('Hack', 'hack')`,
      `insert into public.product_fitments (product_id, motorcycle_version_id, validated) values ('${ids.ativo}', '${ids.v2024}', true)`,
      `insert into public.inventory (product_id, quantity) values ('${ids.inativo}', 5)`,
      `insert into public.product_media (product_id, kind, url) values ('${ids.ativo}', 'image', 'https://evil/x.jpg')`,
    ];
    for (const sql of writes)
      await as("user", async (q) => rejects(q(sql), /row-level security|permission denied/));
    // Sem política de escrita o comando não dá erro: ele simplesmente não atinge nenhuma linha. Conferimos como dono do banco.
    await as("user", async (q, root) => {
      await q(`update public.product_specs set value = 'x'`);
      expect(
        (await root(`select count(*)::int c from public.product_specs where value = 'x'`))[0]!.c,
      ).toBe(0);
      const variants = (await root(`select count(*)::int c from public.product_variants`))[0]!.c;
      await q(`delete from public.product_variants`);
      expect((await root(`select count(*)::int c from public.product_variants`))[0]!.c).toBe(
        variants,
      );
      await q(`update public.motorcycles set active = false`);
      expect(
        (await root(`select count(*)::int c from public.motorcycles where active`))[0]!.c,
      ).toBe(1);
    });
    await as("user", async (q) =>
      rejects(
        q(`insert into public.user_roles (user_id, role) values ('${USER}', 'admin')`),
        /permission denied/,
      ),
    );
    await as("user", async (q) =>
      rejects(q(`update public.user_roles set role = 'admin'`), /permission denied/),
    );
    expect(
      (await su(`select count(*)::int c from public.user_roles where role = 'admin'`))[0]!.c,
    ).toBe(1);
  });

  it("lê e edita só o próprio perfil, e só o nome", async () => {
    await as("user", async (q) => {
      expect((await q(`select id from public.profiles`)).map((r) => r.id)).toEqual([USER]);
      await q(`update public.profiles set display_name = 'Eu' where id = '${USER}'`);
      expect((await q(`select display_name from public.profiles`))[0]!.display_name).toBe("Eu");
    });
    await as("user", async (q) =>
      rejects(
        q(`update public.profiles set id = '${USER2}' where id = '${USER}'`),
        /permission denied/,
      ),
    );
    await as("user", async (q) =>
      rejects(
        q(`update public.profiles set display_name = '${"x".repeat(81)}' where id = '${USER}'`),
      ),
    );
    await as("user", async (q, root) => {
      await q(`update public.profiles set display_name = 'Invasor' where id = '${USER2}'`);
      expect(
        (await root(`select display_name from public.profiles where id = '${USER2}'`))[0]!
          .display_name,
      ).toBe("");
    });
  });
});

describe("RLS: administrador", () => {
  it("vê tudo, inclusive produto inativo, estoque e compatibilidade não validada", async () => {
    await as("admin", async (q) => {
      expect(
        await count(q, `select 1 from public.product_specs where product_id = '${ids.inativo}'`),
      ).toBe(1);
      expect(await count(q, `select 1 from public.inventory`)).toBeGreaterThanOrEqual(2);
      expect(await count(q, `select 1 from public.product_fitments`)).toBe(4);
      expect(await count(q, `select 1 from public.motorcycles`)).toBe(2);
      expect(await count(q, `select 1 from public.product_variants`)).toBe(4);
      expect(await count(q, `select 1 from public.profiles`)).toBe(3);
    });
  });

  it("cria, edita e apaga em todas as tabelas do catálogo", async () => {
    await as("admin", async (q) => {
      await q(`insert into public.brands (name, slug, kind) values ('Nova', 'nova', 'both')`);
      await q(
        `insert into public.motorcycles (brand_id, model, slug) values ((select id from public.brands where slug = 'nova'), 'Modelo', 'nova-modelo')`,
      );
      await q(
        `insert into public.motorcycle_versions (motorcycle_id, year) values ((select id from public.motorcycles where slug = 'nova-modelo'), 2026)`,
      );
      await q(
        `insert into public.product_variants (product_id, sku, name) values ('${ids.ativo}', 'V-NEW', 'Nova')`,
      );
      await q(`update public.inventory set quantity = 9 where product_id = '${ids.ativo}'`);
      await q(
        `insert into public.product_specs (product_id, label, value) values ('${ids.ativo}', 'Cor', 'Preta')`,
      );
      await q(
        `update public.product_experiences set config = '{"x": 1}' where product_id = '${ids.ativo}'`,
      );
      await q(`delete from public.product_fitments where motorcycle_version_id = '${ids.v2024}'`);
      expect(await count(q, `select 1 from public.product_fitments`)).toBe(3);
    });
  });

  it("não consegue ler a quantidade nem escrever como visitante: o papel é o que decide", async () => {
    await as("anon", async (q) =>
      rejects(q(`select quantity from public.inventory`), /permission denied/),
    );
  });
});

describe("RLS: service_role", () => {
  it("acessa tudo (ignora o RLS)", async () => {
    await as("service", async (q) => {
      expect(await count(q, `select 1 from public.inventory`)).toBeGreaterThanOrEqual(2);
      expect(await count(q, `select 1 from public.product_fitments`)).toBe(4);
      expect(await count(q, `select 1 from public.profiles`)).toBe(3);
    });
  });
});

describe("produtos de demonstração (seed)", () => {
  beforeAll(async () => {
    await db.exec(file("docs/seed-demo-products.sql"));
    await db.exec(file("docs/seed-demo-products.sql"));
  });

  it("cria exatamente cinco, sem duplicar ao repetir", async () => {
    const rows = await su(`select name from public.products where is_demo order by sku`);
    expect(rows.map((r) => r.name)).toEqual([
      "[DEMO] Pistão de motocicleta",
      "[DEMO] Disco de freio",
      "[DEMO] Amortecedor traseiro",
      "[DEMO] Capacete integral",
      "[DEMO] Retrovisor esportivo",
    ]);
  });

  it("não inventa marca, preço, compatibilidade nem especificação técnica", async () => {
    const rows = await su(
      `select brand, brand_id, price::text, active, stock_status from public.products where is_demo`,
    );
    for (const r of rows)
      expect(r).toEqual({
        brand: "",
        brand_id: null,
        price: "0.00",
        active: false,
        stock_status: "out_of_stock",
      });
    expect(
      (
        await su(
          `select count(*)::int c from public.product_fitments f join public.products p on p.id = f.product_id where p.is_demo`,
        )
      )[0]!.c,
    ).toBe(0);
    const specs = await su(
      `select label, value from public.product_specs s join public.products p on p.id = s.product_id where p.is_demo`,
    );
    expect(new Set(specs.map((s) => s.label))).toEqual(new Set(["Aviso"]));
  });

  it("deixa cada produto no setor certo e a experiência pretendida, desabilitada", async () => {
    const rows = await su(
      `select p.slug, c.slug as sector, e.type, e.enabled from public.products p join public.categories c on c.id = p.category_id join public.product_experiences e on e.product_id = p.id where p.is_demo order by p.sku`,
    );
    expect(rows).toEqual([
      {
        slug: "demo-pistao-de-motocicleta",
        sector: "engine-power",
        type: "exploded",
        enabled: false,
      },
      { slug: "demo-disco-de-freio", sector: "braking-system", type: "image_360", enabled: false },
      {
        slug: "demo-amortecedor-traseiro",
        sector: "suspension-control",
        type: "interactive_3d",
        enabled: false,
      },
      {
        slug: "demo-capacete-integral",
        sector: "helmets-protection",
        type: "image_360",
        enabled: false,
      },
      {
        slug: "demo-retrovisor-esportivo",
        sector: "design-accessories",
        type: "configurator",
        enabled: false,
      },
    ]);
  });

  it("não aparecem na loja (inativos) e o banco não deixa habilitar sem arquivos", async () => {
    await as("anon", async (q) =>
      expect(await count(q, `select 1 from public.products where is_demo`)).toBe(0),
    );
    await rejects(
      su(
        `update public.product_experiences set enabled = true where product_id = (select id from public.products where slug = 'demo-disco-de-freio')`,
      ),
      /pelo menos 12 quadros/,
    );
  });
});
