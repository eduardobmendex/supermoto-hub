import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Box, Image as ImageIcon, Loader2, Move3d } from "lucide-react";
import { ProductGallery } from "./ProductGallery";
import type { Product } from "@/lib/store";

const ModelViewer = lazy(() => import("./ModelViewer"));

export function ProductStage({ product }: { product: Product }) {
  const has3d = product.model_status === "ready" && !!product.model_url && product.model_approved;
  const [mode, setMode] = useState<"3d" | number>(has3d ? "3d" : 0);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden border bg-stage lg:aspect-auto lg:h-[clamp(28rem,calc(100svh-17rem),52rem)]">
        {mode === "3d" && has3d ? (
          <ClientOnly fallback={<Spinner />}>
            <Suspense fallback={<Spinner />}>
              <ModelViewer url={product.model_url!} />
            </Suspense>
          </ClientOnly>
        ) : product.images.length ? (
          <ProductGallery images={product.images} alt={product.name} index={typeof mode === "number" ? mode : 0} onIndexChange={setMode} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="size-12" /></div>
        )}
        {mode === "3d" && has3d && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Move3d className="size-4 text-primary" /> Arraste para girar · role para zoom
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
