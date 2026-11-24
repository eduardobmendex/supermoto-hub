-- =====================================================================================================
-- APEX, Fase 2: schema do catálogo, compatibilidade, mídia, experiências e perfis.
--
-- COMO APLICAR: o banco deste projeto é gerenciado pelo Lovable. Peça a ele para executar este arquivo
-- como uma migration e regenerar os tipos do Supabase (src/integrations/supabase/types.ts). Não edite
-- supabase/migrations/ nem drizzle/ à mão.
--
-- É seguro rodar mais de uma vez: tudo usa "if not exists", "create or replace" ou "drop ... if exists",
-- e a cópia de dados só insere o que ainda não existe. Depende das migrations atuais do projeto
-- (user_roles, has_role, categories, products, store_settings).
--
-- COMPATIBILIDADE COM O SITE ATUAL: nenhuma coluna ou tabela existente é apagada. products.images,
-- products.specs, products.brand e products.stock_status continuam existindo e são mantidos coerentes
-- (a marca e o estoque por gatilho). Elas serão aposentadas quando o site e o painel lerem as tabelas novas.
-- =====================================================================================================

begin;

-- ---------------------------------------------------------------------------------------------------
-- 0. Funções de apoio
-- ---------------------------------------------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Atalho usado por todas as políticas. Reaproveita has_role(), que já existe e é security definer.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

-- ---------------------------------------------------------------------------------------------------
-- 1. Marcas (de peças e de motocicletas)
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- 'part' fabrica peças, 'motorcycle' fabrica motocicletas (Honda, Yamaha, Suzuki), 'both' faz as duas coisas.
  kind text not null default 'part' check (kind in ('part', 'motorcycle', 'both')),
  logo_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists brands_name_lower_key on public.brands (lower(name));

-- ---------------------------------------------------------------------------------------------------
-- 2. Produtos: evolução da tabela existente (sem apagar nada)
-- ---------------------------------------------------------------------------------------------------

alter table public.products
  add column if not exists sku text,
  add column if not exists brand_id uuid references public.brands (id) on delete set null,
  add column if not exists is_demo boolean not null default false;

create unique index if not exists products_sku_lower_key on public.products (lower(sku)) where sku is not null;
create index if not exists products_brand_id_idx on public.products (brand_id);
create index if not exists products_category_active_idx on public.products (category_id) where active;

-- As regras entram como NOT VALID: valem para toda escrita nova sem falhar por causa de dados antigos.
-- Depois tentamos validar as linhas existentes e só avisamos se alguma não passar.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('products_price_nonneg', 'check (price >= 0)'),
      ('products_old_price_above_price', 'check (old_price is null or old_price > price)'),
      ('products_slug_format', E'check (slug ~ ''^[a-z0-9]+(-[a-z0-9]+)*$'')'),
      ('products_sku_format', E'check (sku is null or sku ~ ''^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$'')'),
      ('products_stock_status_values', 'check (stock_status in (''in_stock'', ''out_of_stock''))')
    ) as t(name, def)
  loop
    if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = c.name) then
      execute format('alter table public.products add constraint %I %s not valid', c.name, c.def);
    end if;
    begin
      execute format('alter table public.products validate constraint %I', c.name);
    exception when check_violation then
      raise warning 'products: linhas antigas violam %, corrija-as e valide a regra depois', c.name;
    end;
  end loop;
end $$;

-- Enquanto products.brand (texto) ainda é lido pelo site, ele acompanha a marca escolhida em brand_id.
create or replace function public.sync_product_brand_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.brand_id is not null then
    select b.name into new.brand from public.brands b where b.id = new.brand_id;
  end if;
  return new;
end $$;

drop trigger if exists products_sync_brand on public.products;
create trigger products_sync_brand before insert or update of brand_id on public.products
  for each row execute function public.sync_product_brand_name();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- 3. Variações, especificações, estoque
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  -- Preço próprio da variação; nulo significa "usa o preço do produto".
  price numeric(10, 2) check (price is null or price >= 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite que outras tabelas apontem para (variação, produto) e garantam que a variação é daquele produto.
  unique (id, product_id)
);
create unique index if not exists product_variants_sku_lower_key on public.product_variants (lower(sku));
create index if not exists product_variants_product_idx on public.product_variants (product_id, sort_order);

create table if not exists public.product_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  value text not null check (length(btrim(value)) between 1 and 500),
  sort_order int not null default 0,
  unique (product_id, label)
);
create index if not exists product_specs_product_idx on public.product_specs (product_id, sort_order);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid,
  quantity int not null default 0 check (quantity >= 0),
  low_stock_threshold int not null default 0 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  foreign key (variant_id, product_id) references public.product_variants (id, product_id) on delete cascade
);
create unique index if not exists inventory_one_row_per_target
  on public.inventory (product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- O cliente vê só "tem ou não tem". A quantidade exata fica restrita à administração (RLS de inventory).
create or replace view public.product_stock_status as
  select i.product_id, i.variant_id, (i.quantity > 0) as in_stock
  from public.inventory i
  join public.products p on p.id = i.product_id and p.active;

-- Mantém products.stock_status coerente para produtos que controlam estoque.
create or replace function public.sync_product_stock_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set stock_status = case when exists (
           select 1 from public.inventory i where i.product_id = target and i.quantity > 0
         ) then 'in_stock' else 'out_of_stock' end
   where p.id = target;
  return null;
end $$;

drop trigger if exists inventory_sync_stock on public.inventory;
create trigger inventory_sync_stock after insert or update or delete on public.inventory
  for each row execute function public.sync_product_stock_status();

-- ---------------------------------------------------------------------------------------------------
-- 4. Mídia (imagens, quadros 360°, modelos 3D)
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid,
  kind text not null check (kind in ('image', 'frame_360', 'model_glb', 'model_gltf')),
  storage_path text,
  url text,
  alt text not null default '',
  sort_order int not null default 0,
  is_primary boolean not null default false,
  -- Posição do quadro na sequência 360° (0, 1, 2...). Obrigatória para frame_360 e proibida nos demais.
  sequence_index int check (sequence_index is null or sequence_index >= 0),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  created_at timestamptz not null default now(),
  constraint product_media_has_source check (storage_path is not null or url is not null),
  constraint product_media_sequence_rule check ((kind = 'frame_360') = (sequence_index is not null)),
  constraint product_media_primary_is_image check (not is_primary or kind = 'image'),
  foreign key (variant_id, product_id) references public.product_variants (id, product_id) on delete cascade
);
create unique index if not exists product_media_one_primary on public.product_media (product_id) where is_primary;
create unique index if not exists product_media_frame_order on public.product_media (product_id, sequence_index) where kind = 'frame_360';
create index if not exists product_media_product_idx on public.product_media (product_id, kind, sort_order);

-- ---------------------------------------------------------------------------------------------------
-- 5. Experiência interativa do produto
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.product_experiences (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  type text not null default 'standard'
    check (type in ('standard', 'image_360', 'interactive_3d', 'exploded', 'installed', 'configurator')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lista o que falta para uma experiência poder ser habilitada. Vazio significa que está tudo disponível.
-- É a mesma regra que o painel mostra ao administrador; o banco a impõe para ninguém burlar.
create or replace function public.experience_missing_assets(p_product uuid, p_type text, p_config jsonb)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  missing text[] := '{}';
  images int; frames int; last_frame int; models int; installed int;
  -- jsonb_typeof(null) é null, e "not null" é null: por isso o coalesce, para chave ausente valer "falso".
  parts_ok boolean := coalesce(case when jsonb_typeof(p_config -> 'parts') = 'array' then jsonb_array_length(p_config -> 'parts') >= 1 end, false);
  options_ok boolean := coalesce(case when jsonb_typeof(p_config -> 'options') = 'array' then jsonb_array_length(p_config -> 'options') >= 1 end, false);
begin
  select count(*) filter (where kind = 'image'),
         count(*) filter (where kind = 'frame_360'),
         coalesce(max(sequence_index) filter (where kind = 'frame_360'), -1),
         count(*) filter (where kind in ('model_glb', 'model_gltf')),
         count(*) filter (where kind = 'image' and meta ->> 'role' = 'installed')
    into images, frames, last_frame, models, installed
    from public.product_media where product_id = p_product;

  if p_type = 'standard' and images < 1 then
    missing := array_append(missing, 'pelo menos 1 imagem');
  end if;
  if p_type = 'image_360' then
    if frames < 12 then missing := array_append(missing, format('pelo menos 12 quadros 360° (há %s)', frames)); end if;
    if frames > 0 and last_frame + 1 <> frames then missing := array_append(missing, 'quadros 360° em sequência contínua, sem lacunas'); end if;
  end if;
  if p_type in ('interactive_3d', 'exploded', 'configurator') and models < 1 then
    missing := array_append(missing, 'um modelo GLB/GLTF');
  end if;
  if p_type = 'exploded' and not parts_ok then
    missing := array_append(missing, 'a lista de peças da vista explodida (config.parts)');
  end if;
  if p_type = 'configurator' and not options_ok then
    missing := array_append(missing, 'as opções do configurador (config.options)');
  end if;
  if p_type = 'installed' and installed < 1 then
    missing := array_append(missing, 'pelo menos 1 imagem marcada como "instalado" (meta.role = installed)');
  end if;
  return missing;
end $$;

create or replace function public.guard_experience_enable() returns trigger
language plpgsql as $$
declare
  missing text[];
begin
  if new.enabled then
    missing := public.experience_missing_assets(new.product_id, new.type, new.config);
    if coalesce(array_length(missing, 1), 0) > 0 then
      raise exception 'A experiência "%" não pode ser habilitada. Falta: %', new.type, array_to_string(missing, '; ')
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists product_experiences_guard on public.product_experiences;
create trigger product_experiences_guard before insert or update on public.product_experiences
  for each row execute function public.guard_experience_enable();

drop trigger if exists product_experiences_set_updated_at on public.product_experiences;
create trigger product_experiences_set_updated_at before update on public.product_experiences
  for each row execute function public.set_updated_at();

-- Se um arquivo necessário for removido depois, a experiência é desabilitada em vez de quebrar na loja.
create or replace function public.disable_experiences_missing_assets() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(old.product_id, new.product_id);
begin
  update public.product_experiences e
     set enabled = false
   where e.product_id = target and e.enabled
     and coalesce(array_length(public.experience_missing_assets(e.product_id, e.type, e.config), 1), 0) > 0;
  return null;
end $$;

drop trigger if exists product_media_keep_experiences_valid on public.product_media;
create trigger product_media_keep_experiences_valid after update or delete on public.product_media
  for each row execute function public.disable_experiences_missing_assets();

-- Todo produto novo nasce com sua experiência padrão (desabilitada até haver uma imagem).
create or replace function public.create_default_experience() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.product_experiences (product_id) values (new.id) on conflict (product_id) do nothing;
  return null;
end $$;

drop trigger if exists products_default_experience on public.products;
create trigger products_default_experience after insert on public.products
  for each row execute function public.create_default_experience();

-- ---------------------------------------------------------------------------------------------------
-- 6. Motocicletas, versões e compatibilidade
-- ---------------------------------------------------------------------------------------------------

create table if not exists public.motorcycles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  model text not null check (length(btrim(model)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  displacement_cc int check (displacement_cc is null or displacement_cc between 1 and 3000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists motorcycles_brand_model_key on public.motorcycles (brand_id, lower(model));

create or replace function public.guard_motorcycle_brand() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.brands b where b.id = new.brand_id and b.kind in ('motorcycle', 'both')) then
    raise exception 'A marca informada não é fabricante de motocicletas (kind = motorcycle ou both)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists motorcycles_guard_brand on public.motorcycles;
create trigger motorcycles_guard_brand before insert or update of brand_id on public.motorcycles
  for each row execute function public.guard_motorcycle_brand();

drop trigger if exists motorcycles_set_updated_at on public.motorcycles;
create trigger motorcycles_set_updated_at before update on public.motorcycles
  for each row execute function public.set_updated_at();

create table if not exists public.motorcycle_versions (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles (id) on delete cascade,
  year int not null check (year between 1950 and 2100),
  version text not null default 'Padrão' check (length(btrim(version)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (motorcycle_id, year, version)
);
create index if not exists motorcycle_versions_motorcycle_idx on public.motorcycle_versions (motorcycle_id, year);

create table if not exists public.product_fitments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  motorcycle_version_id uuid not null references public.motorcycle_versions (id) on delete cascade,
  -- Onde a peça é aplicada quando a moto usa duas (ex.: "dianteiro", "traseiro"). Vazio quando não se aplica.
  position text not null default '' check (length(position) <= 40),
  notes text not null default '',
  restrictions text not null default '',
  -- Só a compatibilidade validada por um administrador aparece na loja.
  validated boolean not null default false,
  validated_by uuid references auth.users (id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_fitments_validation_consistent check (validated = (validated_at is not null)),
  unique (product_id, motorcycle_version_id, position)
);
create index if not exists product_fitments_version_idx on public.product_fitments (motorcycle_version_id) where validated;
create index if not exists product_fitments_product_idx on public.product_fitments (product_id);

-- Carimba quem validou e quando. Mudar o que define a aplicação invalida a validação: a pessoa precisa
-- validar de novo, em vez de uma peça continuar "compatível" com base em dados que já não são os conferidos.
create or replace function public.stamp_fitment_validation() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.validated and new.validated
     and (new.product_id, new.motorcycle_version_id, new.position, new.notes, new.restrictions)
         is distinct from (old.product_id, old.motorcycle_version_id, old.position, old.notes, old.restrictions) then
    new.validated := false;
  end if;
  if new.validated and (tg_op = 'INSERT' or not old.validated) then
    new.validated_at := now();
    new.validated_by := auth.uid();
  elsif new.validated then
    new.validated_at := old.validated_at;
    new.validated_by := old.validated_by;
  else
    new.validated_at := null;
    new.validated_by := null;
  end if;
  return new;
end $$;

drop trigger if exists product_fitments_stamp on public.product_fitments;
create trigger product_fitments_stamp before insert or update on public.product_fitments
  for each row execute function public.stamp_fitment_validation();

drop trigger if exists product_fitments_set_updated_at on public.product_fitments;
create trigger product_fitments_set_updated_at before update on public.product_fitments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- 7. Perfis
-- ---------------------------------------------------------------------------------------------------

-- O papel (admin) continua só em user_roles. Ele nunca fica em profiles, onde o próprio usuário poderia editá-lo.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

insert into public.profiles (id) select u.id from auth.users u on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 8. Segurança: grants e RLS
-- ---------------------------------------------------------------------------------------------------

-- Leitura pública das tabelas de catálogo (as políticas abaixo decidem quais linhas).
grant select on public.brands, public.motorcycles, public.motorcycle_versions, public.product_variants,
  public.product_specs, public.product_media, public.product_experiences, public.product_fitments
  to anon, authenticated;
grant select on public.product_stock_status to anon, authenticated;
-- Escrita: concedida a "authenticated", mas só administradores passam pelas políticas.
grant insert, update, delete on public.brands, public.motorcycles, public.motorcycle_versions,
  public.product_variants, public.product_specs, public.product_media, public.product_experiences,
  public.product_fitments to authenticated;
-- Estoque exato: nenhum acesso para o público (anon); administradores via política.
grant select, insert, update, delete on public.inventory to authenticated;
-- Perfis: o usuário lê o próprio e edita apenas o nome de exibição.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant all on public.brands, public.motorcycles, public.motorcycle_versions, public.product_variants,
  public.product_specs, public.inventory, public.product_media, public.product_experiences,
  public.product_fitments, public.profiles to service_role;
grant select on public.product_stock_status to service_role;

alter table public.brands enable row level security;
alter table public.motorcycles enable row level security;
alter table public.motorcycle_versions enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_specs enable row level security;
alter table public.inventory enable row level security;
alter table public.product_media enable row level security;
alter table public.product_experiences enable row level security;
alter table public.product_fitments enable row level security;
alter table public.profiles enable row level security;

-- Administração: acesso total, inclusive a produtos inativos e a rascunhos.
do $$
declare
  t text;
begin
  foreach t in array array['brands', 'motorcycles', 'motorcycle_versions', 'product_variants', 'product_specs',
                           'inventory', 'product_media', 'product_experiences', 'product_fitments']
  loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Público: só o que está publicado.
drop policy if exists "public read" on public.brands;
create policy "public read" on public.brands for select using (true);

drop policy if exists "public read active" on public.motorcycles;
create policy "public read active" on public.motorcycles for select using (active);

drop policy if exists "public read active" on public.motorcycle_versions;
create policy "public read active" on public.motorcycle_versions for select using (
  exists (select 1 from public.motorcycles m where m.id = motorcycle_id and m.active));

drop policy if exists "public read active" on public.product_variants;
create policy "public read active" on public.product_variants for select using (
  active and exists (select 1 from public.products p where p.id = product_id and p.active));

drop policy if exists "public read active" on public.product_specs;
create policy "public read active" on public.product_specs for select using (
  exists (select 1 from public.products p where p.id = product_id and p.active));

drop policy if exists "public read active" on public.product_media;
create policy "public read active" on public.product_media for select using (
  exists (select 1 from public.products p where p.id = product_id and p.active));

drop policy if exists "public read enabled" on public.product_experiences;
create policy "public read enabled" on public.product_experiences for select using (
  enabled and exists (select 1 from public.products p where p.id = product_id and p.active));

-- Compatibilidade: só a validada, de produto e moto ativos. Nunca se afirma o que não foi conferido.
drop policy if exists "public read validated" on public.product_fitments;
create policy "public read validated" on public.product_fitments for select using (
  validated
  and exists (select 1 from public.products p where p.id = product_id and p.active)
  and exists (select 1 from public.motorcycle_versions v join public.motorcycles m on m.id = v.motorcycle_id
              where v.id = motorcycle_version_id and m.active));

-- Perfis.
drop policy if exists "read own or admin" on public.profiles;
create policy "read own or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "update own" on public.profiles;
create policy "update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------------------------------
-- 9. Cópia dos dados atuais para as tabelas novas (só insere o que ainda não existe)
-- ---------------------------------------------------------------------------------------------------

-- Marcas a partir do texto de products.brand.
insert into public.brands (name, slug, kind)
select distinct on (lower(btrim(p.brand))) btrim(p.brand),
       trim(both '-' from regexp_replace(
         translate(lower(btrim(p.brand)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
         '[^a-z0-9]+', '-', 'g')),
       'part'
  from public.products p
 where btrim(p.brand) <> ''
   and trim(both '-' from regexp_replace(
         translate(lower(btrim(p.brand)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
         '[^a-z0-9]+', '-', 'g')) <> ''
on conflict do nothing;

update public.products p set brand_id = b.id
  from public.brands b
 where p.brand_id is null and btrim(p.brand) <> '' and lower(b.name) = lower(btrim(p.brand));

-- Fotos: a primeira vira a principal.
insert into public.product_media (product_id, kind, url, alt, sort_order, is_primary)
select p.id, 'image', u.url, p.name, u.ord - 1, (u.ord = 1)
  from public.products p
 cross join lateral unnest(p.images) with ordinality as u(url, ord)
 where not exists (select 1 from public.product_media m where m.product_id = p.id and m.kind = 'image' and m.url = u.url)
   and not exists (select 1 from public.product_media m where m.product_id = p.id and m.is_primary and u.ord = 1);

-- Especificações.
insert into public.product_specs (product_id, label, value, sort_order)
select p.id, btrim(e.item ->> 'label'), btrim(e.item ->> 'value'), (e.ord - 1)::int
  from public.products p
 cross join lateral jsonb_array_elements(case when jsonb_typeof(p.specs) = 'array' then p.specs else '[]'::jsonb end)
       with ordinality as e(item, ord)
 where btrim(coalesce(e.item ->> 'label', '')) <> '' and btrim(coalesce(e.item ->> 'value', '')) <> ''
on conflict (product_id, label) do nothing;

-- Uma experiência padrão por produto; já habilitada quando o produto tem imagem.
insert into public.product_experiences (product_id, enabled)
select p.id, exists (select 1 from public.product_media m where m.product_id = p.id and m.kind = 'image')
  from public.products p
on conflict (product_id) do nothing;

commit;
