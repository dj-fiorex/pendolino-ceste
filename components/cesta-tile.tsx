"use client";

import { CheckIcon } from "lucide-react";
import { codiceParts } from "@/lib/ceste";
import { cn } from "@/lib/utils";

/**
 * One Cesta as a tile: the numero large and the `<portata>-<forma>` prefix
 * small above it, as on her Etichetta, and nothing else. A tap toggles her,
 * and a ticked tile is filled.
 *
 * 96 px square, from the prototype the mill chose (#30, #31): the size a thumb
 * hits without looking, on the phone at the counter and on the tablet where the
 * Ceste are emptied.
 */
export function CestaTile({
  codice,
  selected,
  onToggle,
}: {
  codice: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const { prefix, numero } = codiceParts(codice);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Cesta ${codice}`}
      onClick={onToggle}
      className={cn(
        "relative flex size-24 flex-col items-center justify-center gap-1 rounded-xl border transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "text-sm leading-none",
          selected ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {prefix}
      </span>
      <span className="font-display text-3xl leading-none font-bold tabular-nums">
        {numero}
      </span>
      {selected && <CheckIcon className="absolute top-1 right-1 size-4" />}
    </button>
  );
}
