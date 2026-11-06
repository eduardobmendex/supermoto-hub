import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, ZoomIn } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";

/**
 * Product photos: a swipeable stage with a magnifier that follows the cursor, opening into a
 * fullscreen viewer. Works with whatever photos a product has, including just one.
 */
export function ProductGallery({ images, alt, index, onIndexChange }: { images: string[]; alt: string; index: number; onIndexChange: (index: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const count = images.length;
  // While moving to a chosen photo, the slides passed on the way must not count as the selection.
  const scrollTarget = useRef<number | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const instant = firstRender.current;
    firstRender.current = false;
    if (Math.round(el.scrollLeft / el.clientWidth) === index) return;
    scrollTarget.current = instant ? null : index;
    el.scrollTo({ left: index * el.clientWidth, behavior: instant ? "auto" : "smooth" });
  }, [index]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el?.clientWidth) return;
    const current = Math.round(el.scrollLeft / el.clientWidth);
    if (scrollTarget.current !== null) {
      if (current === scrollTarget.current) scrollTarget.current = null;
      return;
    }
    if (current !== index) onIndexChange(current);
  };

  const magnify = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    // Written directly to the element: re-rendering React on every mouse move would be wasteful.
    e.currentTarget.style.setProperty("--zoom-x", `${x}%`);
    e.currentTarget.style.setProperty("--zoom-y", `${y}%`);
  };

  return (
    <div className="group/gallery relative h-full w-full">
      <div ref={scroller} onScroll={onScroll} onPointerDown={() => { scrollTarget.current = null; }} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`Ampliar foto ${i + 1} de ${count} de ${alt}`}
            onClick={() => setFullscreen(true)}
            onPointerMove={magnify}
            className="group/slide relative h-full w-full shrink-0 snap-center cursor-zoom-in overflow-hidden"
          >
            <img
              src={src}
              alt={`${alt}, foto ${i + 1}`}
              draggable={false}
              decoding="async"
              {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
              style={{ transformOrigin: "var(--zoom-x, 50%) var(--zoom-y, 50%)" }}
              className="h-full w-full object-contain p-6 transition-transform duration-300 ease-out group-hover/slide:scale-[2.2] motion-reduce:transition-none"
            />
            {/* A soft light that follows the cursor, so the photo feels alive under the mouse. */}
            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 [background:radial-gradient(circle_at_var(--zoom-x,50%)_var(--zoom-y,50%),oklch(1_0_0/0.10),transparent_45%)] group-hover/slide:opacity-100" />
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition-opacity group-hover/gallery:opacity-0">
        <ZoomIn className="size-4 text-primary" />
        <span className="hidden sm:inline">Passe o mouse para ampliar · clique para tela cheia</span>
        <span className="sm:hidden">Toque para ampliar</span>
      </div>
      <button type="button" aria-label="Abrir em tela cheia" onClick={() => setFullscreen(true)} className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-background/70 backdrop-blur transition hover:bg-primary hover:text-primary-foreground">
        <Maximize2 className="size-4" />
      </button>

      {count > 1 && (
        <>
          <button type="button" aria-label="Foto anterior" onClick={() => onIndexChange((index - 1 + count) % count)} className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/70 opacity-0 backdrop-blur transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover/gallery:opacity-100 md:flex"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Próxima foto" onClick={() => onIndexChange((index + 1) % count)} className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/70 opacity-0 backdrop-blur transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 group-hover/gallery:opacity-100 md:flex"><ChevronRight className="size-5" /></button>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
            {images.map((src, i) => <span key={src} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-foreground/40"}`} />)}
          </div>
        </>
      )}

      {fullscreen && <ImageLightbox images={images} alt={alt} index={index} onIndexChange={onIndexChange} onClose={() => setFullscreen(false)} />}
    </div>
  );
}
