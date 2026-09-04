import Link from "next/link";

/**
 * Chrome for the application pages: search, dashboard, property detail.
 *
 * The landing page does not use this. It has its own floating navigation that
 * changes with the section it sits over, which a fixed product header cannot do.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface)]">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">Propster</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/search"
            className="rounded-lg px-3 py-2 font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            New search
          </Link>
          <Link
            href="/search"
            className="rounded-lg px-3 py-2 font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            Find a property
          </Link>
          <Link
            href="/try"
            className="rounded-lg bg-ink-900 px-3.5 py-2 font-medium text-white transition-colors hover:bg-ink-800"
          >
            Call my phone →
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-ink-900 text-white shadow-sm">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1h-4v-4H8v4H4a1 1 0 0 1-1-1V8.6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-xs leading-relaxed text-ink-400">
          Propster is a hackathon demonstration. All listings and contacts shown are fictional
          demo data and do not represent real properties, real agents or real asking prices.
          Verification calls are placed by an AI agent that identifies itself as such at the
          start of every call.
        </p>
      </div>
    </footer>
  );
}
