/**
 * Art direction manifest.
 *
 * Every image on the landing page is listed here with the narrative job it
 * does, because on this page photography carries meaning rather than filling
 * space. If an image has no job, it does not belong on the page.
 *
 * Assets are vendored into `public/img/` by `npm run vendor:images`, so the
 * page renders with no network access and no third-party CDN in the critical
 * path. Each name resolves to a pair: `<name>.webp` and `<name>-sm.webp`.
 * See `public/img/CREDITS.md` for sources.
 *
 * None of these images is lazy-loaded, deliberately. Most sit inside a
 * `reveal-image` wrapper whose clip-path collapses the box to zero height until
 * its observer fires; a lazy image in a zero-height box is correctly judged
 * invisible by the browser and never fetched, so the picture would appear only
 * if the reveal happened to win a race against the loader. On a deployed build
 * that race was observed to lose, leaving six of eight images unloaded. These
 * photographs carry the page's argument rather than decorating it, so they load
 * eagerly and the reveal animates something that is already there.
 */

export interface Artwork {
  /** Large source. */
  src: string;
  /** Narrow source for mobile and the smaller editorial panels. */
  srcSmall: string;
  /** Empty when the image is purely atmospheric and the text carries meaning. */
  alt: string;
  /** Why this image is on the page at all. */
  role: string;
}

const artwork = (name: string, alt: string, role: string): Artwork => ({
  src: "/img/" + name + ".webp",
  srcSmall: "/img/" + name + "-sm.webp",
  alt,
  role,
});

export const ART = {
  /** 01 — Aspiration. The property you want to believe in. */
  hero: artwork(
    "hero",
    "",
    "Hero. Contemporary timber-clad residence with human scale, shot in warm daylight.",
  ),

  /** 02 — The emotional pull, before any doubt is introduced. */
  interior: artwork(
    "interior",
    "",
    "The property. Warm naturally lit living space — the feeling a listing sells.",
  ),

  /** 03 — The same beauty, now carrying stale data. */
  doubt: artwork(
    "doubt",
    "",
    "The doubt. A bright, desirable apartment interior that the listing data contradicts.",
  ),

  /**
   * 05/06 — The subject under investigation.
   *
   * Deliberately the SAME photograph as `listing` below. Property #04 appears
   * in three sections — pinned during the investigation, at the centre of the
   * evidence dossier, and on the listing side of the comparison — and it has to
   * be recognisably one place each time, or the page reads as three unrelated
   * properties rather than one being tracked from claim to verdict. Each
   * section crops it differently.
   */
  subject: artwork(
    "property-04",
    "",
    "Investigation subject. Property #04, pinned while the evidence accumulates.",
  ),

  /** 08 — Listing versus reality, the same property on both sides. */
  listing: artwork("property-04", "", "Listing vs reality. The advertised photograph."),

  /** 09 — Use cases. */
  useFind: artwork("flat-calm", "", "Use case: find a home. Calm residential interior."),
  useVerify: artwork(
    "use-verify",
    "",
    "Use case: verify before viewing. Exterior approach to a property.",
  ),

  /** 13 — The closing image. Confident, architectural, graded dark. */
  finale: artwork("finale", "", "Final call to action. Assured modern architecture, graded dark."),
} as const satisfies Record<string, Artwork>;
