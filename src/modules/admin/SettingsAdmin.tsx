import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, uploadFile, type Settings } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./fields";
import { errorMessage } from "./files";

export function SettingsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [f, setF] = useState<Settings | undefined>(data);
  useEffect(() => setF(data), [data]);
  if (!f) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF({ ...f, [k]: v });
  const save = async () => {
    const { id: _id, ...rest } = f;
    const { error } = await supabase.from("store_settings").update(rest).eq("id", 1);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    toast.success("Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };
  const text = (
    k:
      | "store_name"
      | "whatsapp"
      | "instagram"
      | "address"
      | "hours"
      | "banner_title"
      | "banner_subtitle",
    label: string,
    hint?: string,
  ) => (
    <Field label={label}>
      <Input value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={hint} />
    </Field>
  );
  const img = (k: "logo_url" | "banner_image", label: string) => (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {f[k] && <img src={f[k]!} alt="" className="h-12 rounded border" />}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) set(k, await uploadFile(file, "settings"));
          }}
        />
        {f[k] && (
          <Button type="button" size="sm" variant="ghost" onClick={() => set(k, null)}>
            Remover
          </Button>
        )}
      </div>
    </Field>
  );

  return (
    <div className="mt-6 grid max-w-3xl gap-4">
      <h2 className="text-2xl font-bold uppercase">Configurações da loja</h2>
      {text("store_name", "Nome da loja")}
      {img("logo_url", "Logotipo")}
      {text("whatsapp", "WhatsApp (com DDI e DDD)", "5511999999999")}
      {text("instagram", "Instagram", "apex")}
      {text("address", "Endereço")}
      {text("hours", "Horário de funcionamento")}
      {text("banner_title", "Título do banner")}
      {text("banner_subtitle", "Subtítulo do banner")}
      {img("banner_image", "Imagem do banner")}
      <div>
        <Button type="button" onClick={() => void save()}>
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
