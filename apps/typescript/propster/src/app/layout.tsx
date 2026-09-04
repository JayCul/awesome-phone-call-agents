import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately thin: it owns the document, the type system and the stylesheet,
 * and nothing else. The marketing landing page and the application pages have
 * very different chrome, so each supplies its own — see `(site)/layout.tsx`.
 */

/**
 * The type system carries the central contrast of the product.
 *
 * `display`     — emotion. Editorial grotesque, set enormous and tight.
 * `accent`      — the human aside, italic serif, used on single words.
 * `information` — evidence. Monospaced, uppercase, tabular. Anything the
 *                 product claims to *know* is set in this face.
 */
const display = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const accent = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-accent",
  weight: "400",
  style: "italic",
  display: "swap",
});

const information = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-information",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Propster — property intelligence",
  description:
    "Listings are claims. Propster verifies them. It searches property listings, then calls the listing agent to confirm availability, price and real-world details before you waste a trip.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={display.variable + " " + accent.variable + " " + information.variable}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
