import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Box, Image as ImageIcon, Loader2, Move3d } from "lucide-react";
import type { Product } from "@/lib/store";

const ModelViewer = lazy(() => import("./ModelViewer"));

export function ProductStage({ product }: { product: Product }) {
  const has3d = product.model_status === "ready" && !!product.model_url && product.model_approved;
  const [mode, setMode] = useState<"3d" | number>(has3d ? "3d" : 0);
  const img = typeof mode === "number" ? product.images[mode] : null;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-stage">
        {mode === "3d" && has3d ? (
          <ClientOnly fallback={<Spinner />}>
            <Suspense fallback={<Spinner />}>
              <ModelViewer url={product.model_url!} />
            </Suspense>
          </ClientOnly>
        ) : img ? (
          <img src={img} alt={product.name} className="h-full w-full object-contain p-6" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="size-12" /></div>
        )}
        {mode === "3d" && has3d && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Move3d className="size-4 text-primary" /> Arraste para girar · role para zoom
          </div>
        )}
        {!has3d && product.model_status === "processing" && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
            <Loader2 className="size-3.5 animate-spin text-primary" /> Visualização 3D em preparação
          </div>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {has3d && (
          <button onClick={() => setMode("3d")} className={`flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border bg-card text-xs font-display uppercase ${mode === "3d" ? "border-primary text-primary" : "text-muted-foreground"}`}>
            <Box className="size-6" /> 3D
          </button>
        )}
        {product.images.map((src, i) => (
          <button key={src} onClick={() => setMode(i)} className={`size-20 shrink-0 overflow-hidden rounded-md border bg-card ${mode === i ? "border-primary" : ""}`}>
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex h-full items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
}
