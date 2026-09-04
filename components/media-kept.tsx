import type { MediaLinks } from "@/convex/schema";
import { mediaLabel } from "@/lib/media";

/** One of the two, as the history shows it: a thumbnail, and a tap to open it. */
function Kept({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="grid gap-1 rounded-lg border bg-card p-1"
    >
      {/* The mill's own file out of Convex storage, shown at the size a
          thumbnail is: nothing here wants an optimiser in front of it. The
          signature carries its own white paper, so nothing is put behind it. */}
      <img
        src={href}
        alt={label}
        className="h-20 w-28 rounded object-contain"
      />
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </a>
  );
}

/**
 * What a Cliente left at the counter when he took his Ceste away: his
 * signature, and the photograph of the load on his trailer (#25).
 *
 * Shown on the Ritiro that took a Cesta out, and on nothing else, because that
 * is where they hang — one signature and one photograph for the whole action,
 * however many Ceste went out on it (ADR-0006). Six Ceste each show the same
 * pair on their own page, and no page shows either twice.
 *
 * Most Ritiri have neither and this comes to nothing, which is the point: both
 * are optional by the mill's own decision, and a morning of a hundred and
 * fifty people skips them (spec #1, story 19).
 */
export function MediaKept({ media }: { media: MediaLinks }) {
  if (media.signature === null && media.photo === null) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {media.signature !== null && (
        <Kept label={mediaLabel.signature} href={media.signature} />
      )}
      {media.photo !== null && (
        <Kept label={mediaLabel.photo} href={media.photo} />
      )}
    </div>
  );
}
