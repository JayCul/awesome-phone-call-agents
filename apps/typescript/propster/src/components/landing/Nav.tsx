"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Floating navigation.
 *
 * It sits over the hero photograph with no chrome at all, then adopts a solid
 * treatment once the page scrolls past the image. Sections declare whether
 * they are dark or light via `data-nav`, and the nav reads the one currently
 * under it — so it stays legible over both the property world and the
 * near-black investigation world without a hard-coded scroll offset.
 */

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#verification", label: "Verification" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [onDark, setOnDark] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      setScrolled(window.scrollY > 40);

      // Which themed section is under the navigation bar right now?
      const probe = 44;
      const sections = document.querySelectorAll<HTMLElement>("[data-nav]");
      let active: "dark" | "light" = "light";
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) {
          active = section.dataset.nav === "dark" ? "dark" : "light";
        }
      }
      setOnDark(active === "dark");
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

  const foreground = onDark ? "text-white" : "text-void-900";
  const muted = onDark ? "text-white/60" : "text-void-900/55";

  return (
    <header
      className={
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-500 " +
        (scrolled
          ? onDark
            ? "border-b border-white/10 bg-void-900/70 backdrop-blur-xl"
            : "border-b border-black/[0.06] bg-white/75 backdrop-blur-xl"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-6 lg:px-10">
        {/* Left: wordmark */}
        <Link
          href="/"
          className={"type-info text-[13px] tracking-[0.28em] transition-colors " + foreground}
        >
          PROPSTER
        </Link>

        {/* Centre: section links */}
        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={
                "type-info text-[10px] transition-colors duration-300 hover:opacity-100 " +
                muted +
                " hover:" +
                foreground.replace("text-", "text-")
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right: the action */}
        <div className="flex items-center gap-3">
          <Link
            href="/try"
            className={
              "type-info hidden items-center gap-2 rounded-full border px-5 py-2.5 text-[10px] transition-all duration-300 sm:inline-flex " +
              (onDark
                ? "border-white/25 text-white hover:border-white hover:bg-white hover:text-void-900"
                : "border-void-900/20 text-void-900 hover:border-void-900 hover:bg-void-900 hover:text-white")
            }
          >
            Call my phone
            <span aria-hidden="true">→</span>
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Menu"
            className={"md:hidden " + foreground}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d={open ? "M6 6l12 12M18 6L6 18" : "M4 8h16M4 16h16"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open ? (
        <div className="border-t border-white/10 bg-void-900/95 px-6 py-6 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-5">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="type-info text-[11px] text-white/70"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/try"
              className="type-info mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[10px] text-void-900"
            >
              Call my phone <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
