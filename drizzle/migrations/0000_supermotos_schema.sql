create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id,role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- first registered user becomes admin (store owner)
create or replace function public.assign_first_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id,'admin');
  end if; return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.assign_first_admin();

create table public.categories (id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, image_url text, sort_order int not null default 0, created_at timestamptz not null default now());
grant select on public.categories to anon, authenticated; grant insert,update,delete on public.categories to authenticated; grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public read cat" on public.categories for select using (true);
create policy "admin write cat" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text not null default '',
 price numeric(10,2) not null default 0, old_price numeric(10,2), brand text not null default '', category_id uuid references public.categories(id) on delete set null,
 images text[] not null default '{}', sizes text[] not null default '{}', colors text[] not null default '{}', specs jsonb not null default '[]',
 stock_status text not null default 'in_stock', active boolean not null default true, featured boolean not null default false, is_new boolean not null default false,
 model_url text, model_status text not null default 'none', model_error text, model_approved boolean not null default false, model_job_id text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select on public.products to anon, authenticated; grant insert,update,delete on public.products to authenticated; grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read active" on public.products for select using (active or public.has_role(auth.uid(),'admin'));
create policy "admin write prod" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.store_settings (id int primary key default 1 check (id=1), store_name text not null default 'SuperMotos', logo_url text, whatsapp text not null default '5511999999999', instagram text default 'supermotos', address text default 'Av. das Motos, 1000 - São Paulo, SP', hours text default 'Seg a Sex 9h–18h · Sáb 9h–13h', banner_title text default 'Equipamento de elite para quem vive sobre duas rodas', banner_subtitle text default 'Veja cada detalhe em 3D antes de comprar.', banner_image text);
grant select on public.store_settings to anon, authenticated; grant update on public.store_settings to authenticated; grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
create policy "public read settings" on public.store_settings for select using (true);
create policy "admin update settings" on public.store_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.store_settings(id) values (1);

insert into public.categories(name,slug,sort_order) values ('Capacetes','capacetes',1),('Luvas','luvas',2),('Jaquetas','jaquetas',3),('Botas','botas',4),('Vestuário','vestuario',5),('Acessórios','acessorios',6),('Peças','pecas',7),('Proteção','protecao',8);

insert into public.products(name,slug,description,price,old_price,brand,category_id,featured,is_new,specs,sizes,colors) values
('Capacete Apex Carbon','capacete-apex-carbon','Capacete integral em fibra de carbono, viseira antiembaçante e forro removível.',1899.90,2199.90,'Apex',(select id from categories where slug='capacetes'),true,true,'[{"label":"Material","value":"Fibra de carbono"},{"label":"Peso","value":"1.250 g"},{"label":"Certificação","value":"INMETRO / ECE 22.06"}]','{P,M,G,GG}','{Preto fosco,Branco}'),
('Luva Racer Pro','luva-racer-pro','Luva de couro com proteção em TPU nos nós dos dedos e compatível com touchscreen.',349.90,null,'Racer',(select id from categories where slug='luvas'),true,false,'[{"label":"Material","value":"Couro bovino"}]','{P,M,G}','{Preta}'),
('Jaqueta Storm Touring','jaqueta-storm-touring','Jaqueta impermeável com protetores nível 2 em ombros e cotovelos.',1299.90,1499.90,'Storm',(select id from categories where slug='jaquetas'),true,true,'[{"label":"Impermeável","value":"Sim"}]','{M,G,GG}','{Preta,Cinza}'),
('Bota Trail X','bota-trail-x','Bota off-road com fivelas de alumínio e solado antiderrapante.',899.90,null,'Trail',(select id from categories where slug='botas'),false,true,'[]','{39,40,41,42,43}','{Preta}');

insert into storage.objects(bucket_id,name) select 'x','x' where false;
