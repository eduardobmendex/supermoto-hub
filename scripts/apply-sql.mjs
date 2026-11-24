// Aplica os SQLs do projeto num Supabase, na ordem certa.
//
//   node scripts/apply-sql.mjs            aplica setup-base, apex-sectors e schema
//   node scripts/apply-sql.mjs --demo     inclui também os 5 produtos DEMO
//   node scripts/apply-sql.mjs --check    só mostra o que existe no banco, sem alterar nada
//
// A conexão vem de DATABASE_URL em .env.local (arquivo ignorado pelo git). A senha nunca é impressa.
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

const FILES = ["setup-base.sql", "apex-sectors.sql", "schema.sql"];
const DEMO = "seed-demo-products.sql";
const args = new Set(process.argv.slice(2));

function readEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const local = readEnv(".env.local");
const shared = readEnv(".env");
const url = local.DATABASE_URL ?? process.env.DATABASE_URL;
const expectedRef = shared.SUPABASE_PROJECT_ID;

if (!url) fail("DATABASE_URL não encontrada. Crie o arquivo .env.local com: DATABASE_URL=postgresql://postgres:SUASENHA@db.<projeto>.supabase.co:5432/postgres");
if (/\[YOUR-DATABASE-PASSWORD\]|SUASENHA|\[.*\]/.test(url)) fail("A DATABASE_URL ainda tem o marcador no lugar da senha. Substitua pela senha real do banco.");

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail("A DATABASE_URL não é uma URL válida. Se a senha tem caracteres especiais (@ : / # ?), troque-os pela forma codificada (%40 %3A %2F %23 %3F).");
}
if (!parsed.password) fail("A DATABASE_URL não tem senha.");

// Trava: nunca aplicar num projeto diferente do que o resto da configuração aponta.
if (expectedRef && !parsed.hostname.includes(expectedRef)) {
  fail(`A DATABASE_URL aponta para "${parsed.hostname}", mas o SUPABASE_PROJECT_ID do .env é "${expectedRef}". Nada foi executado.`);
}
console.log(`Projeto: ${parsed.hostname}  (senha oculta)`);

const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 20, onnotice: () => {} });

try {
  const [{ db, usr }] = await sql`select current_database() as db, current_user as usr`;
  console.log(`Conectado: banco "${db}", usuário "${usr}"`);

  const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  console.log(`Tabelas já existentes em public: ${tables.length ? tables.map((t) => t.table_name).join(", ") : "(nenhuma)"}`);
  if (args.has("--check")) {
    await sql.end();
    process.exit(0);
  }

  const queue = args.has("--demo") ? [...FILES, DEMO] : FILES;
  for (const name of queue) {
    process.stdout.write(`→ ${name} ... `);
    await sql.unsafe(readFileSync(`docs/${name}`, "utf8"));
    console.log("ok");
  }

  const after = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  const [{ n: categories }] = await sql`select count(*)::int as n from public.categories`;
  const [{ n: products }] = await sql`select count(*)::int as n from public.products`;
  console.log(`\nPronto. Tabelas em public: ${after.length}. Categorias: ${categories}. Produtos: ${products}.`);
} catch (error) {
  // Mostra o motivo do banco, sem a URL (que contém a senha).
  console.error(`\n✖ Falhou: ${error.message}`);
  if (error.position) console.error(`  (posição ${error.position} do arquivo em execução)`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
