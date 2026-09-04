/**
 * Vendored image helpers.
 *
 * Every photograph ships in the repository at two widths, emitted by
 * `npm run vendor:images`:
 *
 *   /img/<name>.webp      large
 *   /img/<name>-sm.webp   small
 *
 * A listing stores one `imageUrl` — the large asset — because a single column
 * is all the data model needs. `responsiveSources` derives the pair so a
 * property card can serve the small file instead of downscaling a 1280px image
 * into a 400px slot.
 */

export interface ImagePair {
  src: string;
  /** `undefined` when no small variant can be derived, so callers can omit srcSet. */
  small?: string;
}

/** Local vendored assets follow `/img/<name>.webp`. Anything else is left alone. */
const VENDORED = /^\/img\/([a-z0-9-]+)\.webp$/i;

export function responsiveSources(url: string | undefined): ImagePair | undefined {
  if (!url) return undefined;
  const match = VENDORED.exec(url);
  if (!match) return { src: url };
  return { src: url, small: "/img/" + match[1] + "-sm.webp" };
}

/** Build the `srcSet` attribute for a pair, or `undefined` when there is one source. */
export function srcSetFor(pair: ImagePair | undefined, smallWidth = 640, largeWidth = 1280) {
  if (!pair?.small) return undefined;
  return pair.small + " " + smallWidth + "w, " + pair.src + " " + largeWidth + "w";
}
