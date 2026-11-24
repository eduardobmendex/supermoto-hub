# APEX: arquitetura

Plataforma de peças para motocicletas. Segue em **TanStack Start** (React 19, Vite, Cloudflare), ligado ao Lovable, com Supabase, Tailwind 4 e shadcn/ui. A migração para Next.js foi descartada: ela quebraria a sincronização com o Lovable.

## Princípios
- Rotas finas em `src/routes/`. A lógica fica em `src/modules/<domínio>/`.
- Negócio, interface e 3D não se misturam: o Three.js só é carregado pelo componente que o usa (lazy), nunca por consultas ou rotas.
- Nada de catálogo fixo no código: produtos, categorias e (depois) compatibilidade vêm do banco.
- O banco é gerenciado pelo Lovable. Mudanças de schema ficam em `docs/*.sql` e são aplicadas por ele. O repositório não tem migrations editadas à mão.

## Estrutura

```
src/
  modules/
    catalog/      sectors.ts (identidade dos 9 setores), catalog.ts (consultas e filtros)
    fitment/      (fase 4) busca por moto, compatibilidade, garagem
    experience/   (fase 3) ProductExperience e os visualizadores
    explorer/     (fase 4) Motorcycle Explorer
    cart/         (fase 5)
  components/
    brand/        Wordmark, Reveal
    ui/           shadcn
  routes/         index, catalogo, produto.$slug, admin, auth
  lib/            store.ts (cliente e consultas gerais), utils
docs/             schema e decisões
```

## Dados
- **Setor = categoria.** A chave de cada setor é o `slug` de uma categoria. Veja `docs/apex-sectors.sql`.
- **Catálogo (`/catalogo`).** O estado dos filtros fica na URL (validado com Zod). As consultas rodam no servidor, com paginação de 24 itens, ordenação e busca textual. Não há filtragem no navegador.
- **Home.** As faixas de destaque e novidades vêm do banco e somem quando estão vazias.

## Fases
| Fase | Escopo | Estado |
|---|---|---|
| 1 | Tema, navegação, home, catálogo, página do produto | em andamento |
| 2 | Schema APEX (marcas, motos, compatibilidade, mídia, estoque, perfis), RLS, painel | schema e RLS prontos e testados; painel e vitrine pendentes |
| 3 | `ProductExperience`: 360°, 3D, exploded view, hotspots | pendente |
| 4 | Motorcycle Explorer, garagem, busca por moto | pendente |
| 5 | Carrinho, checkout, pagamento, frete | pendente |

## Fase 2: banco de dados

Arquivos, na ordem em que o Lovable deve executá-los (cada um é seguro de repetir):

1. `docs/apex-sectors.sql`: as 9 categorias dos setores.
2. `docs/schema.sql`: as tabelas novas, regras, gatilhos, RLS e a cópia dos dados atuais.
3. `docs/seed-demo-products.sql` (opcional): 5 produtos DEMO, inativos.

Depois, o Lovable regenera `src/integrations/supabase/types.ts`. Não editar à mão.

**Aplicar o `schema.sql` junto com a versão do painel que lê as tabelas novas.** Até lá, o painel atual continua gravando fotos e especificações em `products.images` e `products.specs`, e as tabelas `product_media` e `product_specs` ficariam desatualizadas. Reexecutar o `schema.sql` recopia o que faltar.

Regras que o banco impõe (não dependem do painel):

- **Compatibilidade:** só o que um administrador validou (`validated`) aparece na loja. Mudar a aplicação de uma compatibilidade validada a invalida.
- **Experiências:** só podem ser habilitadas com os arquivos exigidos (por exemplo, 12 quadros contínuos para 360°, um modelo para 3D). Se um arquivo for removido depois, a experiência é desabilitada sozinha.
- **Estoque:** a quantidade exata é só da administração; a loja vê apenas "tem" ou "não tem" (`product_stock_status`).
- **Perfis:** o papel de administrador fica em `user_roles`, nunca em `profiles`.

Testes: `src/test/db/schema.test.ts` roda esses SQLs sobre as migrations reais, num Postgres de verdade (PGlite), e cobre as políticas para visitante, cliente, administrador e `service_role`.

## Pontos de atenção
- **Pagamento:** sem gateway contratado, o fluxo de compra é o pedido pelo WhatsApp, identificado como tal.
- **3D sem GPU:** os modelos de demonstração serão geometria paramétrica em Three.js, e nenhum asset será inventado.
- **Animações:** a fase 1 não adiciona dependências. As revelações ao rolar são CSS puro (`.reveal`, animação guiada por rolagem): o conteúdo fica visível por padrão, inclusive sem JavaScript, e respeita `prefers-reduced-motion`. `framer-motion` e GSAP entram na fase 3, quando houver interação que precise de JavaScript.
