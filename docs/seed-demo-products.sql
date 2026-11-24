-- Cinco produtos de DEMONSTRAÇÃO para validar as experiências do produto (Fase 3).
--
-- Pré-requisitos: docs/apex-sectors.sql (categorias dos setores) e docs/schema.sql já aplicados.
-- Rode com o Lovable, como as demais migrations. É seguro repetir: não duplica nem sobrescreve o que o
-- administrador já editou.
--
-- NADA aqui é real: sem marca, sem preço (R$ 0,00), sem especificação técnica e sem compatibilidade.
-- Os produtos nascem INATIVOS (active = false), então não aparecem na loja nem podem ser pedidos.
-- Para vê-los na loja durante os testes:
--   update public.products set active = true where is_demo;
-- E para tirá-los de novo:
--   update public.products set active = false where is_demo;
-- Os tipos de experiência abaixo ficam DESABILITADOS: o banco só deixa habilitar quando os arquivos existirem.

begin;

insert into public.products (name, slug, sku, description, price, category_id, is_demo, active, stock_status)
select d.name, d.slug, d.sku, d.description, 0,
       (select c.id from public.categories c where c.slug = d.sector), true, false, 'out_of_stock'
  from (values
    ('[DEMO] Pistão de motocicleta',   'demo-pistao-de-motocicleta',   'DEMO-001', 'Produto de demonstração para validar a vista explodida.',                'engine-power'),
    ('[DEMO] Disco de freio',          'demo-disco-de-freio',          'DEMO-002', 'Produto de demonstração para validar a rotação 360°.',                    'braking-system'),
    ('[DEMO] Amortecedor traseiro',    'demo-amortecedor-traseiro',    'DEMO-003', 'Produto de demonstração para validar a animação de compressão.',          'suspension-control'),
    ('[DEMO] Capacete integral',       'demo-capacete-integral',       'DEMO-004', 'Produto de demonstração para validar a visualização 360° do capacete.',   'helmets-protection'),
    ('[DEMO] Retrovisor esportivo',    'demo-retrovisor-esportivo',    'DEMO-005', 'Produto de demonstração para validar a troca de acabamento e cores.',     'design-accessories')
  ) as d(name, slug, sku, description, sector)
on conflict (slug) do nothing;

-- Tipo de experiência pretendido (só se o administrador ainda não mudou do padrão).
update public.product_experiences e
   set type = d.exp, config = d.config::jsonb
  from public.products p
  join (values
    ('demo-pistao-de-motocicleta', 'exploded',       '{}'),
    ('demo-disco-de-freio',        'image_360',      '{}'),
    ('demo-amortecedor-traseiro',  'interactive_3d', '{"animation": "compression"}'),
    ('demo-capacete-integral',     'image_360',      '{}'),
    ('demo-retrovisor-esportivo',  'configurator',   '{}')
  ) as d(slug, exp, config) on d.slug = p.slug
 where e.product_id = p.id and p.is_demo and e.type = 'standard' and not e.enabled;

insert into public.product_specs (product_id, label, value)
select p.id, 'Aviso', 'Produto de demonstração, sem especificações, marca, preço ou compatibilidade reais.'
  from public.products p
 where p.is_demo
on conflict (product_id, label) do nothing;

commit;
