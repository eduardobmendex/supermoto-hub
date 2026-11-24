import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { brandsAdminQuery, motorcyclesAdminQuery, type MotorcycleWithVersions } from "./api";
import { errorMessage } from "./files";
import { EmptyNote, selectClass } from "./fields";

export function MotorcyclesAdmin() {
  const qc = useQueryClient();
  const { data: brands = [] } = useQuery(brandsAdminQuery);
  const { data: motos = [], isLoading } = useQuery(motorcyclesAdminQuery);
  const makers = brands.filter((b) => b.kind === "motorcycle" || b.kind === "both");
  const [brandId, setBrandId] = useState("");
  const [model, setModel] = useState("");
  const [cc, setCc] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "motorcycles"] });
    qc.invalidateQueries({ queryKey: ["admin", "fitments"] });
  };

  const addMoto = async () => {
    const maker = makers.find((b) => b.id === (brandId || makers[0]?.id));
    const cleanModel = model.trim();
    if (!maker) {
      toast.error("Cadastre antes uma marca do tipo Motocicletas.");
      return;
    }
    if (!cleanModel) {
      toast.error("Informe o modelo.");
      return;
    }
    const displacement = cc.trim() ? Number(cc) : null;
    if (
      displacement !== null &&
      (!Number.isInteger(displacement) || displacement < 1 || displacement > 3000)
    ) {
      toast.error("Cilindrada inválida (1 a 3000 cc).");
      return;
    }
    const { error } = await supabase.from("motorcycles").insert({
      brand_id: maker.id,
      model: cleanModel,
      slug: slugify(`${maker.name} ${cleanModel}`),
      displacement_cc: displacement,
    });
    if (error) {
      toast.error(
        /duplicate key/i.test(error.message)
          ? "Esta motocicleta já está cadastrada."
          : errorMessage(error),
      );
      return;
    }
    setModel("");
    setCc("");
    refresh();
    toast.success("Motocicleta cadastrada.");
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("motorcycles").update({ active }).eq("id", id);
    if (error) toast.error(errorMessage(error));
    refresh();
  };

  const removeMoto = async (id: string, label: string) => {
    if (!confirm(`Excluir "${label}", com todas as versões e compatibilidades ligadas a ela?`))
      return;
    const { error } = await supabase.from("motorcycles").delete().eq("id", id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  };

  const addVersion = async (motorcycleId: string, year: string, version: string) => {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1950 || y > 2100) {
      toast.error("Informe um ano entre 1950 e 2100.");
      return;
    }
    const { error } = await supabase.from("motorcycle_versions").insert({
      motorcycle_id: motorcycleId,
      year: y,
      ...(version.trim() ? { version: version.trim() } : {}),
    });
    if (error) {
      toast.error(
        /duplicate key/i.test(error.message) ? "Esta versão já existe." : errorMessage(error),
      );
      return;
    }
    refresh();
  };

  const removeVersion = async (id: string) => {
    const { error } = await supabase.from("motorcycle_versions").delete().eq("id", id);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  };

  return (
    <div className="mt-6 max-w-4xl">
      <h2 className="mb-1 text-2xl font-bold uppercase">Motocicletas</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Modelos, cilindradas, anos e versões. É a base da compatibilidade: uma peça só é ligada a
        uma versão que existe aqui.
      </p>
      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addMoto();
        }}
      >
        <select
          className={cn(selectClass, "w-auto")}
          aria-label="Fabricante"
          value={brandId || makers[0]?.id || ""}
          onChange={(e) => setBrandId(e.target.value)}
        >
          {makers.length === 0 && <option value="">Nenhuma marca de motocicletas</option>}
          {makers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Input
          className="min-w-48 flex-1"
          placeholder="Modelo (ex.: CG 160 Fan)"
          aria-label="Modelo"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Input
          className="w-32"
          type="number"
          placeholder="Cilindrada (cc)"
          aria-label="Cilindrada em cc"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
        />
        <Button type="submit" disabled={makers.length === 0}>
          <Plus /> Adicionar
        </Button>
      </form>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : motos.length ? (
        <div className="space-y-3">
          {motos.map((m) => (
            <MotoCard
              key={m.id}
              moto={m}
              onToggle={toggle}
              onRemove={removeMoto}
              onAddVersion={addVersion}
              onRemoveVersion={removeVersion}
            />
          ))}
        </div>
      ) : (
        <EmptyNote>
          Nenhuma motocicleta ainda. Cadastre as marcas de motocicletas primeiro, depois os modelos.
        </EmptyNote>
      )}
    </div>
  );
}

type MotoRow = MotorcycleWithVersions;

function MotoCard({
  moto,
  onToggle,
  onRemove,
  onAddVersion,
  onRemoveVersion,
}: {
  moto: MotoRow;
  onToggle: (id: string, active: boolean) => void;
  onRemove: (id: string, label: string) => void;
  onAddVersion: (motorcycleId: string, year: string, version: string) => void;
  onRemoveVersion: (id: string) => void;
}) {
  const [year, setYear] = useState("");
  const [version, setVersion] = useState("");
  const label = `${moto.brands?.name ?? ""} ${moto.model}`.trim();
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{label}</p>
          <p className="tech text-muted-foreground">
            {moto.displacement_cc ? `${moto.displacement_cc} cc · ` : ""}
            {moto.slug}
          </p>
        </div>
        <label className="tech flex items-center gap-2 text-muted-foreground">
          <Switch
            checked={moto.active}
            onCheckedChange={(v) => onToggle(moto.id, v)}
            aria-label={`Ativa: ${label}`}
          />{" "}
          Ativa
        </label>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Excluir ${label}`}
          onClick={() => onRemove(moto.id, label)}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {moto.motorcycle_versions.map((v) => (
          <Badge key={v.id} variant="secondary" className="gap-1">
            {v.year} · {v.version}
            <button
              type="button"
              aria-label={`Remover versão ${v.year} ${v.version}`}
              onClick={() => onRemoveVersion(v.id)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {moto.motorcycle_versions.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Sem versões. Adicione ao menos um ano.
          </span>
        )}
      </div>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAddVersion(moto.id, year, version);
          setYear("");
          setVersion("");
        }}
      >
        <Input
          className="w-28"
          type="number"
          placeholder="Ano"
          aria-label={`Ano da versão de ${label}`}
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <Input
          className="w-48"
          placeholder="Versão (padrão: Padrão)"
          aria-label={`Nome da versão de ${label}`}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          aria-label={`Adicionar versão de ${label}`}
        >
          <Plus /> Versão
        </Button>
      </form>
    </div>
  );
}
