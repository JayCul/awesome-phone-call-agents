"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll choreography primitives.
 *
 * No animation library. Everything here is an IntersectionObserver toggling a
 * class, or a scroll listener writing a CSS custom property — so the browser
 * only ever animates transform, opacity and clip-path.
 *
 * Every hook honours `prefers-reduced-motion`: reduced-motion users get the
 * final state immediately rather than a degraded animation.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Adds `is-visible` once the element scrolls into view, and by default keeps
 * it — content should not un-reveal when you scroll back up.
 */
export function useInView<T extends HTMLElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }

    const once = options?.once ?? true;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setInView(false);
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? "0px 0px -12% 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin, options?.once]);

  return { ref, inView };
}

type RevealVariant = "fade" | "line" | "image" | "rule";

const VARIANT_CLASS: Record<RevealVariant, string> = {
  fade: "reveal",
  line: "reveal-line",
  image: "reveal-image",
  rule: "reveal-rule",
};

/**
 * The workhorse entrance. `line` wraps its children in the mask element the
 * CSS expects, so a display line rises from behind its own edge.
 */
export function Reveal({
  children,
  variant = "fade",
  delay = 0,
  className = "",
  threshold,
  style,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  threshold?: number;
  style?: CSSProperties;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold });
  const state = inView ? " is-visible" : "";
  const delayStyle = { ["--reveal-delay" as string]: delay + "ms" };

  /**
   * The image variant needs two nodes.
   *
   * `reveal-image` hides itself with `clip-path: inset(0 0 100% 0)`, which
   * gives the element a zero-area intersection rectangle. Observing that same
   * element means the observer never reports it as intersecting, so it could
   * never reveal itself — it would stay clipped forever. Observing an
   * unclipped outer node breaks the cycle.
   */
  if (variant === "image") {
    return (
      <div ref={ref} className={className} style={style}>
        <div className={"reveal-image" + state} style={delayStyle}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={VARIANT_CLASS[variant] + state + (className ? " " + className : "")}
      style={{ ...delayStyle, ...style }}
    >
      {variant === "line" ? <span>{children}</span> : children}
    </div>
  );
}

/**
 * Progress of an element through the viewport, 0 → 1.
 *
 * 0 when the element's top hits the bottom of the viewport, 1 when its bottom
 * leaves the top. Drives the sticky, scroll-told sections. Uses rAF so a fast
 * scroll produces at most one read per frame.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height + viewport;
      if (total <= 0) return;
      const travelled = viewport - rect.top;
      setProgress(Math.max(0, Math.min(1, travelled / total)));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress };
}

/**
 * Maps scroll progress across a sticky section onto a discrete step index,
 * with a lead-in and run-out so the first and last states hold on screen
 * rather than flashing past.
 */
export function useScrollSteps<T extends HTMLElement>(count: number) {
  const { ref, progress } = useScrollProgress<T>();
  const usable = Math.max(0, Math.min(1, (progress - 0.12) / 0.72));
  const step = Math.min(count - 1, Math.max(0, Math.floor(usable * count)));
  return { ref, step, progress };
}

/**
 * A label that follows the cursor inside its container, used to make property
 * imagery feel investigable. Desktop pointers only — it is suppressed on touch,
 * where there is no hover state to reward, and for reduced-motion users.
 */
export function HoverLabel({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      window.matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion(),
    );
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !enabled) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      const el = labelRef.current;
      if (el) el.style.transform = "translate3d(" + x + "px," + y + "px,0) translate(-50%,-50%)";
    };

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    node.addEventListener("pointermove", onMove);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
    };
  }, [enabled]);

  return (
    <div
      ref={containerRef}
      className={"relative " + className}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      {children}
      {enabled ? (
        <span
          ref={labelRef}
          aria-hidden="true"
          className={
            "type-info pointer-events-none absolute left-0 top-0 z-20 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[10px] text-void-900 shadow-lg transition-opacity duration-300 " +
            (active ? "opacity-100" : "opacity-0")
          }
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Counts a number up once it is in view. Used for the verification score,
 * where the number assembling itself is the point.
 */
export function useCountUp(target: number, durationMs = 1600) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.5 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let frame = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const elapsed = now - started;
      const t = Math.min(1, elapsed / durationMs);
      // Ease-out cubic, so the number decelerates into its final value.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, durationMs]);

  return { ref, value };
}

/**
 * Steps through a scripted sequence on a timer once in view. Powers the live
 * investigation panel, which the visitor watches rather than drives.
 */
export function useTimedSequence(length: number, stepMs: number, holdMs = 2600) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setIndex(length);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let current = 0;

    const advance = () => {
      current += 1;
      setIndex(current);
      if (current <= length) {
        timer = setTimeout(advance, current === length ? holdMs : stepMs);
      } else {
        // Loop the demonstration so a visitor arriving late still sees it.
        current = 0;
        setIndex(0);
        timer = setTimeout(advance, stepMs);
      }
    };

    timer = setTimeout(advance, stepMs);
    return () => clearTimeout(timer);
  }, [inView, length, stepMs, holdMs]);

  return { ref, index };
}
