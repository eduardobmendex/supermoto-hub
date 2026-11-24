-- =====================================================================================================
-- APEX: BASE para um projeto Supabase NOVO e VAZIO.
--
-- É o equivalente às migrations antigas (drizzle/migrations/0000 e 0001), mas sem os dados da loja
-- anterior: não cria produtos nem categorias de exemplo, e a loja nasce com a identidade APEX.
--
-- ORDEM de execução (SQL Editor do Supabase, um arquivo por vez):
--   1. docs/setup-base.sql        (este)
--   2. docs/apex-sectors.sql      (os 9 setores)
--   3. docs/schema.sql            (catálogo, compatibilidade, mídia, experiências, perfis)
--   4. docs/seed-demo-products.sql (opcional: 5 produtos DEMO)
--
-- Seguro de repetir. ATENÇÃO: o PRIMEIRO usuário que se cadastrar vira administrador da loja.
-- Cadastre a sua conta logo depois de rodar este arquivo (ou desative o cadastro público antes).
-- =====================================================================================================

begin;

-- Papéis de usuário ---------------------------------------------------------------------------------
do $$
begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "own roles" on public.user_roles;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- O primeiro usuário registrado vira o dono da loja.
create or replace function public.assign_first_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin after insert on auth.users
  for each row execute function public.assign_first_admin();

-- Categorias (os setores da APEX entram em apex-sectors.sql) ----------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
drop policy if exists "public read cat" on public.categories;
create policy "public read cat" on public.categories for select using (true);
drop policy if exists "admin write cat" on public.categories;
create policy "admin write cat" on public.categories for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Produtos (o schema.sql evolui esta tabela) --------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  old_price numeric(10, 2),
  brand text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  images text[] not null default '{}',
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  specs jsonb not null default '[]',
  stock_status text not null default 'in_stock',
  active boolean not null default true,
  featured boolean not null default false,
  is_new boolean not null default false,
  model_url text,
  model_status text not null default 'none',
  model_error text,
  model_approved boolean not null default false,
  model_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
drop policy if exists "public read active" on public.products;
create policy "public read active" on public.products for select
  using (active or public.has_role(auth.uid(), 'admin'));
drop policy if exists "admin write prod" on public.products;
create policy "admin write prod" on public.products for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Configurações da loja (uma única linha) -----------------------------------------------------------
create table if not exists public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'APEX',
  logo_url text,
  -- Sem número padrão: um número de exemplo faria os clientes falarem com a pessoa errada.
  whatsapp text not null default '',
  instagram text,
  address text,
  hours text,
  banner_title text default 'Peças com engenharia de pista',
  banner_subtitle text default 'Motor, freios, suspensão e mais, organizados por sistema.',
  banner_image text
);
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
drop policy if exists "public read settings" on public.store_settings;
create policy "public read settings" on public.store_settings for select using (true);
drop policy if exists "admin update settings" on public.store_settings;
create policy "admin update settings" on public.store_settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

-- Armazenamento de arquivos (fotos e modelos) -------------------------------------------------------
-- Bucket privado: o site usa links assinados. Leitura de objetos liberada, escrita só da administração.
insert into storage.buckets (id, name, public) values ('products', 'products', false) on conflict (id) do nothing;

drop policy if exists "public read products files" on storage.objects;
create policy "public read products files" on storage.objects for select using (bucket_id = 'products');
drop policy if exists "admin insert products files" on storage.objects;
create policy "admin insert products files" on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "admin update products files" on storage.objects;
create policy "admin update products files" on storage.objects for update to authenticated
  using (bucket_id = 'products' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "admin delete products files" on storage.objects;
create policy "admin delete products files" on storage.objects for delete to authenticated
  using (bucket_id = 'products' and public.has_role(auth.uid(), 'admin'));

commit;
