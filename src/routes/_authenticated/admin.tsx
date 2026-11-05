import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Wand2, RefreshCw, Check, LogOut, Loader2, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, formatBRL, productsQuery, settingsQuery, slugify, uploadFile, STATUS_LABEL, type Product, type Category, type Spec } from "@/lib/store";
import { startModelGeneration, checkModelGeneration } from "@/lib/model3d.functions";
import { ProductStage } from "@/components/ProductStage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel — SuperMotos" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  const logout = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <div className="p-10"><p>Esta conta não tem acesso de administração.</p><Button variant="outline" className="mt-4" onClick={logout}>Sair</Button></div>;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="font-display text-xl font-bold uppercase italic">Super<span className="text-primary">Motos</span></Link>
          <Badge variant="secondary">Painel</Badge>
          <Button variant="ghost" size="sm" className="ml-auto" asChild><Link to="/"><ExternalLink /> Ver loja</Link></Button>
          <Button variant="outline" size="sm" onClick={logout}><LogOut /> Sair</Button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="products">
          <TabsList><TabsTrigger value="products">Produtos</TabsTrigger><TabsTrigger value="categories">Categorias</TabsTrigger><TabsTrigger value="settings">Configurações</TabsTrigger></TabsList>
          <TabsContent value="products"><ProductsAdmin /></TabsContent>
          <TabsContent value="categories"><CategoriesAdmin /></TabsContent>
          <TabsContent value="settings"><SettingsAdmin /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------------- Products ---------------- */
function ProductsAdmin() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const check = useServerFn(checkModelGeneration);

  // Poll AI 3D jobs in background
  const processing = products.filter((p) => p.model_status === "processing").map((p) => p.id).join(",");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(async () => {
      for (const id of processing.split(",")) await check({ data: { productId: id } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["products"] });
    }, 10000);
    return () => clearInterval(t);
  }, [processing, check, qc]);

  const remove = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="mt-6">
      <div className="mb-4 flex justify-between"><h2 className="text-2xl font-bold uppercase">Produtos</h2><Button onClick={() => setEditing({})}><Plus /> Novo produto</Button></div>
      <div className="divide-y rounded-lg border bg-card">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-3">
            <div className="size-14 shrink-0 overflow-hidden rounded bg-stage">{p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{cats.find((c) => c.id === p.category_id)?.name} · {formatBRL(Number(p.price))}</p>
            </div>
            <div className="hidden gap-1 md:flex">
              {!p.active && <Badge variant="outline">Inativo</Badge>}
              {p.featured && <Badge variant="secondary">Destaque</Badge>}
              <Badge variant={p.model_status === "ready" ? "default" : p.model_status === "failed" ? "destructive" : "outline"}>
                {p.model_status === "processing" && <Loader2 className="animate-spin" />}{STATUS_LABEL[p.model_status]}{p.model_status === "ready" && !p.model_approved && " (aguardando aprovação)"}
              </Badge>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 /></Button>
          </div>
        ))}
        {!products.length && <p className="p-6 text-muted-foreground">Nenhum produto ainda.</p>}
      </div>
      {editing && <ProductEditor initial={editing} cats={cats} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProductEditor({ initial, cats, onClose }: { initial: Partial<Product>; cats: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Partial<Product>>({ images: [], sizes: [], colors: [], specs: [], active: true, stock_status: "in_stock", price: 0, brand: "", description: "", ...initial });
  const [busy, setBusy] = useState(false);
  const start = useServerFn(startModelGeneration);
  const set = (k: keyof Product, v: any) => setF((o) => ({ ...o, [k]: v }));
  const specs = (f.specs as Spec[]) ?? [];
  const { data: live } = useQuery({ ...productsQuery, select: (all) => all.find((p) => p.id === f.id) });
  const current = live ?? (f as Product);

  const save = async (close = true) => {
    if (!f.name) { toast.error("Informe o nome."); return null; }
    setBusy(true);
    const payload = {
      name: f.name, slug: f.slug || slugify(f.name), description: f.description ?? "", price: Number(f.price) || 0,
      old_price: f.old_price ? Number(f.old_price) : null, brand: f.brand ?? "", category_id: f.category_id ?? null,
      images: f.images ?? [], sizes: f.sizes ?? [], colors: f.colors ?? [], specs: specs.filter((s) => s.label) as any,
      stock_status: f.stock_status ?? "in_stock", active: !!f.active, featured: !!f.featured, is_new: !!f.is_new, updated_at: new Date().toISOString(),
    };
    const res = f.id ? await supabase.from("products").update(payload).eq("id", f.id).select().single() : await supabase.from("products").insert(payload).select().single();
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return null; }
    qc.invalidateQueries({ queryKey: ["products"] });
    setF((o) => ({ ...o, id: res.data.id, slug: res.data.slug }));
    toast.success("Produto salvo.");
    if (close) onClose();
    return res.data.id as string;
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadFile(file, "images")));
      set("images", [...(f.images ?? []), ...urls]);
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const generate = async () => {
    const id = f.id ?? (await save(false));
    if (!id) return;
    await supabase.from("products").update({ images: f.images ?? [] }).eq("id", id);
    try {
      const r = await start({ data: { productId: id } });
      toast[r.ok ? "success" : "error"](r.ok ? "Geração 3D iniciada. Você pode continuar trabalhando." : "Não foi possível iniciar a geração 3D.");
    } catch (e: any) { toast.error(e.message); }
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const uploadModel = async (file?: File) => {
    if (!file) return;
    const id = f.id ?? (await save(false));
    if (!id) return;
    setBusy(true);
    try {
      const url = await uploadFile(file, "models");
      await supabase.from("products").update({ model_url: url, model_status: "ready", model_error: null, model_approved: true }).eq("id", id);
      toast.success("Modelo 3D enviado e aprovado.");
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const approve = async (v: boolean) => {
    await supabase.from("products").update({ model_approved: v }).eq("id", f.id!);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Marca"><Input value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Preço (R$)"><Input type="number" step="0.01" value={f.price ?? ""} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Preço anterior (oferta)"><Input type="number" step="0.01" value={f.old_price ?? ""} onChange={(e) => set("old_price", e.target.value || null)} /></Field>
          <Field label="Categoria">
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.category_id ?? ""} onChange={(e) => set("category_id", e.target.value || null)}>
              <option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Disponibilidade">
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.stock_status ?? "in_stock"} onChange={(e) => set("stock_status", e.target.value)}>
              <option value="in_stock">Disponível</option><option value="out_of_stock">Indisponível</option>
            </select>
          </Field>
          <Field label="Tamanhos (separados por vírgula)"><Input value={(f.sizes ?? []).join(", ")} onChange={(e) => set("sizes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
          <Field label="Cores (separadas por vírgula)"><Input value={(f.colors ?? []).join(", ")} onChange={(e) => set("colors", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Field>
        </div>
        <Field label="Descrição"><Textarea rows={4} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="flex flex-wrap gap-6">
          {([["active", "Ativo"], ["featured", "Destaque"], ["is_new", "Lançamento"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><Switch checked={!!f[k]} onCheckedChange={(v) => set(k, v)} />{l}</label>
          ))}
        </div>

        <div>
          <Label>Características técnicas</Label>
          <div className="mt-2 space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Ex.: Material" value={s.label} onChange={(e) => set("specs", specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input placeholder="Ex.: Couro" value={s.value} onChange={(e) => set("specs", specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" onClick={() => set("specs", specs.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => set("specs", [...specs, { label: "", value: "" }])}><Plus /> Adicionar</Button>
          </div>
        </div>

        <div>
          <Label>Fotografias</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(f.images ?? []).map((src) => (
              <div key={src} className="relative size-20 overflow-hidden rounded border">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5" onClick={() => set("images", f.images!.filter((x) => x !== src))}><Trash2 className="size-3" /></button>
              </div>
            ))}
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-xs text-muted-foreground hover:border-primary">
              <Upload className="size-5" /> Enviar<input type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
            </label>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold uppercase">Modelo 3D</h3>
            <Badge variant={current.model_status === "ready" ? "default" : current.model_status === "failed" ? "destructive" : "outline"}>
              {current.model_status === "processing" && <Loader2 className="animate-spin" />}{STATUS_LABEL[current.model_status ?? "none"]}
            </Badge>
            {current.model_status === "ready" && <Badge variant={current.model_approved ? "secondary" : "outline"}>{current.model_approved ? "Aprovado" : "Aguardando aprovação"}</Badge>}
          </div>
          {current.model_error && <p className="mt-2 text-sm text-destructive">{current.model_error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={generate} disabled={busy || current.model_status === "processing" || !(f.images ?? []).length}>
              {current.model_status === "failed" ? <RefreshCw /> : <Wand2 />}{current.model_status === "failed" ? "Tentar novamente" : current.model_status === "ready" ? "Gerar novamente" : "Gerar 3D com IA"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <label className="cursor-pointer"><Upload /> Enviar GLB/GLTF<input type="file" accept=".glb,.gltf,model/gltf-binary" hidden onChange={(e) => uploadModel(e.target.files?.[0])} /></label>
            </Button>
            {current.model_status === "ready" && f.id && (
              <Button size="sm" variant={current.model_approved ? "ghost" : "secondary"} onClick={() => approve(!current.model_approved)}><Check />{current.model_approved ? "Revogar aprovação" : "Aprovar modelo"}</Button>
            )}
          </div>
          {current.model_status === "ready" && current.model_url && (
            <div className="mt-4 max-w-sm"><ProductStage product={{ ...current, model_approved: true }} /></div>
          )}
        </div>

        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save()} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Salvar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/* ---------------- Categories ---------------- */
function CategoriesAdmin() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const add = async () => {
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name, slug: slugify(name), sort_order: cats.length + 1 });
    if (error) { toast.error(error.message); return; }
    setName(""); refresh();
  };
  const update = async (id: string, patch: Partial<Category>) => {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) toast.error(error.message); refresh();
  };
  const move = async (i: number, d: number) => {
    const a = cats[i], b = cats[i + d];
    if (!a || !b) return;
    await supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id);
    refresh();
  };

  return (
    <div className="mt-6 max-w-3xl">
      <h2 className="mb-4 text-2xl font-bold uppercase">Categorias</h2>
      <div className="mb-4 flex gap-2"><Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={add}><Plus /> Adicionar</Button></div>
      <div className="divide-y rounded-lg border bg-card">
        {cats.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 p-3">
            <label className="size-12 shrink-0 cursor-pointer overflow-hidden rounded border bg-stage" title="Imagem">
              {c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : <Upload className="m-auto mt-3 size-5 text-muted-foreground" />}
              <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) update(c.id, { image_url: await uploadFile(file, "categories") }); }} />
            </label>
            <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && update(c.id, { name: e.target.value })} />
            <Button size="icon" variant="ghost" onClick={() => move(i, -1)}><ArrowUp /></Button>
            <Button size="icon" variant="ghost" onClick={() => move(i, 1)}><ArrowDown /></Button>
            <Button size="icon" variant="ghost" onClick={async () => { if (confirm(`Excluir ${c.name}?`)) { await supabase.from("categories").delete().eq("id", c.id); refresh(); } }}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [f, setF] = useState(data);
  useEffect(() => setF(data), [data]);
  if (!f) return null;
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const save = async () => {
    const { id, ...rest } = f;
    const { error } = await supabase.from("store_settings").update(rest).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas."); qc.invalidateQueries({ queryKey: ["settings"] });
  };
  const text = (k: keyof typeof f, l: string, hint?: string) => (
    <Field label={l}><Input value={(f[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={hint} /></Field>
  );
  const img = (k: "logo_url" | "banner_image", l: string) => (
    <Field label={l}>
      <div className="flex items-center gap-3">
        {f[k] && <img src={f[k]!} alt="" className="h-12 rounded border" />}
        <Input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set(k, await uploadFile(file, "settings")); }} />
        {f[k] && <Button size="sm" variant="ghost" onClick={() => set(k, null)}>Remover</Button>}
      </div>
    </Field>
  );
  return (
    <div className="mt-6 grid max-w-3xl gap-4">
      <h2 className="text-2xl font-bold uppercase">Configurações da loja</h2>
      {text("store_name", "Nome da loja")}
      {img("logo_url", "Logotipo")}
      {text("whatsapp", "WhatsApp (com DDI e DDD)", "5511999999999")}
      {text("instagram", "Instagram", "supermotos")}
      {text("address", "Endereço")}
      {text("hours", "Horário de funcionamento")}
      {text("banner_title", "Título do banner")}
      {text("banner_subtitle", "Subtítulo do banner")}
      {img("banner_image", "Imagem do banner")}
      <div><Button onClick={save}>Salvar configurações</Button></div>
    </div>
  );
}
