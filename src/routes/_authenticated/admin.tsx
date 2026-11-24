import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandsAdmin } from "@/modules/admin/BrandsAdmin";
import { CategoriesAdmin } from "@/modules/admin/CategoriesAdmin";
import { MotorcyclesAdmin } from "@/modules/admin/MotorcyclesAdmin";
import { ProductsAdmin } from "@/modules/admin/products/ProductsAdmin";
import { SettingsAdmin } from "@/modules/admin/SettingsAdmin";
import { Wordmark } from "@/components/brand/Wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel — APEX" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
  const logout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) return <div className="p-10 text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return (
      <div className="p-10">
        <p>Esta conta não tem acesso de administração.</p>
        <Button variant="outline" className="mt-4" onClick={logout}>
          Sair
        </Button>
      </div>
    );

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" aria-label="APEX, página inicial">
            <Wordmark />
          </Link>
          <Badge variant="secondary">Painel</Badge>
          <Button variant="ghost" size="sm" className="ml-auto" asChild>
            <Link to="/">
              <ExternalLink /> Ver loja
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut /> Sair
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="products">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="motorcycles">Motocicletas</TabsTrigger>
            <TabsTrigger value="brands">Marcas</TabsTrigger>
            <TabsTrigger value="categories">Setores</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ProductsAdmin />
          </TabsContent>
          <TabsContent value="motorcycles">
            <MotorcyclesAdmin />
          </TabsContent>
          <TabsContent value="brands">
            <BrandsAdmin />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesAdmin />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
