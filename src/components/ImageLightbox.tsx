import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

const MAX_SCALE = 5;
const TAP_ZOOM = 2.5;
const SWIPE_DISTANCE = 70;
const DOUBLE_TAP_MS = 300;

type View = { scale: number; x: number; y: number };
const INITIAL_VIEW: View = { scale: 1, x: 0, y: 0 };
type Point = { x: number; y: number };

/** The size an `object-contain` image really occupies inside its box. */
function fittedSize(img: HTMLImageElement) {
  const { clientWidth: w, clientHeight: h, naturalWidth: nw, naturalHeight: nh } = img;
  if (!nw || !nh) return { w, h };
  const ratio = Math.min(w / nw, h / nh);
  return { w: nw * ratio, h: nh * ratio };
}

/** Keeps the photo covering the screen: it can't be dragged away and leave empty space behind. */
function clampView(view: View, img: HTMLImageElement): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, view.scale));
  const size = fittedSize(img);
  const maxX = Math.max(0, (size.w * scale - img.clientWidth) / 2);
  const maxY = Math.max(0, (size.h * scale - img.clientHeight) / 2);
  return { scale, x: Math.min(maxX, Math.max(-maxX, view.x)), y: Math.min(maxY, Math.max(-maxY, view.y)) };
}

/** Zooms keeping `point` (relative to the image's center) under the finger or cursor. */
function zoomAt(view: View, scale: number, point: Point): View {
  const ratio = scale / view.scale;
  return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}

function PanZoomImage({ src, alt, onPrevious, onNext, onClose }: { src: string; alt: string; onPrevious: () => void; onNext: () => void; onClose: () => void }) {
  const img = useRef<HTMLImageElement>(null);
  const view = useRef<View>(INITIAL_VIEW);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ moved: false, startX: 0, startY: 0, distance: 0, midX: 0, midY: 0, pinched: false, lastTap: 0 });
  const [zoomed, setZoomed] = useState(false);

  const apply = useCallback((next: View, animate = false, swipe: Point = { x: 0, y: 0 }) => {
    const el = img.current;
    if (!el) return;
    view.current = clampView(next, el);
    const { scale, x, y } = view.current;
    el.style.transition = animate ? "transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 250ms" : "none";
    el.style.transform = `translate(${x + swipe.x}px, ${y + swipe.y}px) scale(${scale})`;
    el.style.opacity = swipe.y ? String(Math.max(0.3, 1 - Math.abs(swipe.y) / 400)) : "1";
    setZoomed(scale > 1.01);
  }, []);

  const pointFrom = (clientX: number, clientY: number): Point => {
    const box = img.current!.getBoundingClientRect();
    const { x, y } = view.current;
    return { x: clientX - (box.left + box.width / 2) + x, y: clientY - (box.top + box.height / 2) + y };
  };

  // React attaches wheel listeners as passive, which can't stop the page from scrolling.
  useEffect(() => {
    const el = img.current?.parentElement;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = Math.min(MAX_SCALE, Math.max(1, view.current.scale * Math.exp(-e.deltaY * 0.002)));
      apply(zoomAt(view.current, scale, pointFrom(e.clientX, e.clientY)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [apply]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 1) Object.assign(g, { moved: false, pinched: false, startX: e.clientX, startY: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      Object.assign(g, { pinched: true, distance: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 8) g.moved = true;

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const scale = Math.min(MAX_SCALE, Math.max(1, view.current.scale * (distance / (g.distance || distance))));
      const next = zoomAt(view.current, scale, pointFrom(midX, midY));
      apply({ scale, x: next.x + midX - g.midX, y: next.y + midY - g.midY });
      Object.assign(g, { distance, midX, midY });
    } else if (view.current.scale > 1.01) {
      apply({ ...view.current, x: view.current.x + e.clientX - previous.x, y: view.current.y + e.clientY - previous.y });
    } else if (!g.pinched) {
      // Not zoomed: the finger drags the whole photo, previewing a swipe to change photo or close.
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      apply(INITIAL_VIEW, false, Math.abs(dy) > Math.abs(dx) ? { x: 0, y: dy } : { x: dx, y: 0 });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId) || pointers.current.size > 0) return;
    const g = gesture.current;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (view.current.scale <= 1.01 && !g.pinched && g.moved) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_DISTANCE) return onClose();
      // Settles first: with a single photo, changing photo does nothing and it must not stay offset.
      apply(INITIAL_VIEW, true);
      if (Math.abs(dx) > SWIPE_DISTANCE) dx > 0 ? onPrevious() : onNext();
      return;
    }
    if (g.moved || g.pinched) return;

    const now = Date.now();
    if (now - g.lastTap < DOUBLE_TAP_MS) {
      g.lastTap = 0;
      apply(view.current.scale > 1.01 ? INITIAL_VIEW : zoomAt(view.current, TAP_ZOOM, pointFrom(e.clientX, e.clientY)), true);
    } else {
      g.lastTap = now;
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (view.current.scale <= 1.01) apply(INITIAL_VIEW, true);
  };

  const zoomBy = useCallback((factor: number) => apply(zoomAt(view.current, Math.min(MAX_SCALE, Math.max(1, view.current.scale * factor)), { x: 0, y: 0 }), true), [apply]);
  const reset = useCallback(() => apply(INITIAL_VIEW, true), [apply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") zoomBy(1.5);
      else if (e.key === "-") zoomBy(1 / 1.5);
      else if (e.key === "0") reset();
      else if (e.key === "ArrowLeft") onPrevious();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, reset, onPrevious, onNext]);

  return (
    <>
      <div
        className={`absolute inset-0 touch-none select-none ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <img ref={img} src={src} alt={alt} draggable={false} decoding="async" className="h-full w-full object-contain animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none" />
      </div>
      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2 md:bottom-28 md:right-6">
        <LightboxButton label="Aproximar" onClick={() => zoomBy(1.5)}><ZoomIn /></LightboxButton>
        <LightboxButton label="Afastar" onClick={() => zoomBy(1 / 1.5)}><ZoomOut /></LightboxButton>
        {zoomed && <LightboxButton label="Restaurar" onClick={reset}><RotateCcw /></LightboxButton>}
      </div>
    </>
  );
}

function LightboxButton({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`flex size-11 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur transition hover:bg-primary hover:text-primary-foreground [&_svg]:size-5 ${className}`}>
      {children}
    </button>
  );
}

export function ImageLightbox({ images, alt, index, onIndexChange, onClose }: { images: string[]; alt: string; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  const count = images.length;
  const previous = useCallback(() => onIndexChange((index - 1 + count) % count), [index, count, onIndexChange]);
  const next = useCallback(() => onIndexChange((index + 1) % count), [index, count, onIndexChange]);

  // Neighboring photos are fetched ahead of time, so swiping never lands on a blank screen.
  useEffect(() => {
    for (const offset of [-1, 1]) {
      const src = images[(index + offset + count) % count];
      if (src) new Image().src = src;
    }
  }, [images, index, count]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl animate-in fade-in duration-200" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-50 outline-none">
          <Dialog.Title className="sr-only">Fotos de {alt}</Dialog.Title>
          <div className="absolute inset-x-0 bottom-20 top-0 md:bottom-24">
            {/* Remounting per photo resets the zoom when the photo changes. */}
            <PanZoomImage key={images[index]} src={images[index]!} alt={`${alt}, foto ${index + 1} de ${count}`} onPrevious={previous} onNext={next} onClose={onClose} />
          </div>

          <div className="absolute left-4 top-4 rounded-full bg-background/70 px-3 py-1.5 font-display text-sm backdrop-blur" aria-live="polite">{index + 1} / {count}</div>
          <Dialog.Close asChild>
            <button type="button" aria-label="Fechar" className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-background/70 backdrop-blur transition hover:bg-primary hover:text-primary-foreground"><X className="size-5" /></button>
          </Dialog.Close>

          {count > 1 && (
            <>
              <LightboxButton label="Foto anterior" onClick={previous} className="absolute left-4 top-1/2 hidden -translate-y-1/2 md:flex"><ChevronLeft /></LightboxButton>
              <LightboxButton label="Próxima foto" onClick={next} className="absolute right-4 top-1/2 hidden -translate-y-1/2 md:flex"><ChevronRight /></LightboxButton>
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 overflow-x-auto px-4">
                {images.map((src, i) => (
                  <button key={src} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === index} onClick={() => onIndexChange(i)} className={`size-14 shrink-0 overflow-hidden rounded-md border-2 bg-card transition md:size-16 ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
