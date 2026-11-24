import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { motorcyclesAdminQuery, productFitmentsQuery } from "../api";
import { EmptyNote, Field, selectClass } from "../fields";
import { errorMessage } from "../files";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

export function FitmentsTab({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: motos = [] } = useQuery(motorcyclesAdminQuery);
  const { data: fitments = [], isLoading } = useQuery(productFitmentsQuery(productId));
  const withVersions = motos.filter((m) => m.motorcycle_versions.length > 0);
  const [motoId, setMotoId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [restrictions, setRestrictions] = useState("");

  const moto = withVersions.find((m) => m.id === (motoId || withVersions[0]?.id));
  const version =
    moto?.motorcycle_versions.find((v) => v.id === versionId) ?? moto?.motorcycle_versions[0];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "fitments", productId] });
    qc.invalidateQueries({ queryKey: ["fitments"] });
  };

  const add = async () => {
    if (!version) {
      toast.error("Escolha a motocicleta e a versão.");
      return;
    }
    const { error } = await supabase.from("product_fitments").insert({
      product_id: productId,
      motorcycle_version_id: version.id,
      position: position.trim(),
      notes: notes.trim(),
      restrictions: restrictions.trim(),
    });
    if (error) {
      toast.error(
        /duplicate key/i.test(error.message)
          ? "Esta aplicação já está cadastrada."
          : errorMessage(error),
      );
      return;
    }
    setPosition("");
    setNotes("");
    setRestrictions("");
    toast.success("Aplicação adicionada. Ela só aparece na loja depois de validada.");
    refresh();
  };

  const validate = async (id: string, validated: boolean) => {
    const { error } = await supabase.from("product_fitments").update({ validated }).eq("id", id);
    if (error) toast.error(errorMessage(error));
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta aplicação?")) return;
    const { error } = await supabase.from("product_fitments").delete().eq("id", id);
    if (error) toast.error(errorMessage(error));
    refresh();
  };

  return (
    <div className="space-y-5">
      <p className="flex gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />A loja só afirma que uma peça
        serve numa moto quando você marca a aplicação como <strong>validada</strong>, depois de
        conferir. Se você mudar uma aplicação já validada, a validação é desfeita e precisa ser
        refeita.
      </p>

      {withVersions.length === 0 ? (
        <EmptyNote>
          Cadastre motocicletas com ao menos uma versão (ano) na aba Motocicletas para poder ligar
          peças a elas.
        </EmptyNote>
      ) : (
        <form
          className="space-y-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Motocicleta">
              <select
                className={selectClass}
                value={moto?.id ?? ""}
                onChange={(e) => {
                  setMotoId(e.target.value);
                  setVersionId("");
                }}
              >
                {withVersions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brands?.name} {m.model}
                    {m.displacement_cc ? ` (${m.displacement_cc} cc)` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ano e versão">
              <select
                className={selectClass}
                value={version?.id ?? ""}
                onChange={(e) => setVersionId(e.target.value)}
              >
                {moto?.motorcycle_versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year} · {v.version}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Posição"
              hint="Quando a moto usa duas peças, ex.: dianteiro ou traseiro. Opcional."
            >
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </Field>
            <Field label="Restrições" hint="Ex.: somente com ABS. Opcional.">
              <Input value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
            </Field>
          </div>
          <Field label="Observações de aplicação">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button type="submit" size="sm">
            <Plus /> Adicionar aplicação
          </Button>
        </form>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : fitments.length ? (
        <ul className="divide-y rounded-md border bg-card">
          {fitments.map((f) => {
            const v = f.motorcycle_versions;
            const label = v
              ? `${v.motorcycles?.brands?.name ?? ""} ${v.motorcycles?.model ?? ""} · ${v.year} · ${v.version}`
              : "Versão removida";
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {label}
                    {f.position && (
                      <span className="tech ml-2 text-muted-foreground">{f.position}</span>
                    )}
                  </p>
                  {(f.restrictions || f.notes) && (
                    <p className="text-xs text-muted-foreground">
                      {[f.restrictions, f.notes].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {f.validated && (
                    <p className="tech text-muted-foreground">
                      Validada em {fmtDate(f.validated_at)}
                    </p>
                  )}
                </div>
                <Badge variant={f.validated ? "default" : "outline"}>
                  {f.validated ? "Validada" : "Pendente"}
                </Badge>
                <label className="tech flex items-center gap-2 text-muted-foreground">
                  <Switch
                    checked={f.validated}
                    onCheckedChange={(v) => void validate(f.id, v)}
                    aria-label={`Validar: ${label}`}
                  />{" "}
                  Validar
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${label}`}
                  onClick={() => void remove(f.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyNote>
          Nenhuma aplicação cadastrada. Sem compatibilidade validada, a loja não afirma que a peça
          serve em nenhuma moto.
        </EmptyNote>
      )}
    </div>
  );
}
