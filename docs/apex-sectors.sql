-- Setores da APEX como categorias. Este projeto tem o banco gerenciado pelo Lovable: peça a ele para
-- executar este SQL (ou crie as 9 categorias, com exatamente estes slugs, na aba Categorias do painel).
-- O slug de cada categoria é a chave do setor usado pelo site: não o altere.
-- Estas categorias substituem as da loja anterior (Capacetes, Luvas...). Se já houver produtos nelas,
-- reatribua-os antes: o vínculo é `on delete set null`, então apagar uma categoria deixa o produto sem setor.

insert into public.categories (name, slug, sort_order) values
  ('Engine & Power',        'engine-power',        1),
  ('Braking System',        'braking-system',      2),
  ('Suspension & Control',  'suspension-control',  3),
  ('Wheels & Tires',        'wheels-tires',        4),
  ('Transmission',          'transmission',        5),
  ('Exhaust & Performance', 'exhaust-performance', 6),
  ('Design & Accessories',  'design-accessories',  7),
  ('Helmets & Protection',  'helmets-protection',  8),
  ('Electrical System',     'electrical-system',   9)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Opcional, só se a loja anterior ainda não tiver produtos reais:
-- delete from public.categories where slug in ('capacetes','luvas','jaquetas','botas','vestuario','acessorios','pecas','protecao');
