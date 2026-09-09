import type { Id } from "@/convex/_generated/dataModel";
import type { FoundCesta } from "@/lib/ceste";
import type { Cliente } from "@/lib/cliente";
import { isCesta, isCliente } from "@/lib/ritiro-draft";

export type RientroDraft = {
  confirmationPending?: boolean;
  identifiedBy: FoundCesta | null;
  cliente: Cliente | null;
  searching: boolean;
  ticked: Id<"ceste">[];
  alsoHere: FoundCesta[];
};
export type SvuotamentoDraft = {
  confirmationPending?: boolean;
  selected: Id<"ceste">[];
  keyed: FoundCesta[];
};
export type MovementDrafts = {
  rientro: RientroDraft;
  svuotamento: SvuotamentoDraft;
};
const isIds = (value: unknown) =>
  Array.isArray(value) && value.every((id) => typeof id === "string");
const isCeste = (value: unknown) =>
  Array.isArray(value) && value.every(isCesta);

function valid<K extends keyof MovementDrafts>(
  kind: K,
  value: unknown,
): value is MovementDrafts[K] {
  if (typeof value !== "object" || value === null) return false;
  if (
    "confirmationPending" in value &&
    typeof value.confirmationPending !== "boolean"
  )
    return false;
  if (kind === "svuotamento") {
    const draft = value as SvuotamentoDraft;
    return isIds(draft.selected) && isCeste(draft.keyed);
  }
  const draft = value as RientroDraft;
  return (
    (draft.identifiedBy === null || isCesta(draft.identifiedBy)) &&
    (draft.cliente === null || isCliente(draft.cliente)) &&
    typeof draft.searching === "boolean" &&
    isIds(draft.ticked) &&
    isCeste(draft.alsoHere)
  );
}

export function readMovementDraft<K extends keyof MovementDrafts>(
  kind: K,
): MovementDrafts[K] | null {
  try {
    const raw = window.localStorage.getItem(`pendolino.${kind}`);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    if (
      typeof stored !== "object" ||
      stored === null ||
      !("version" in stored) ||
      stored.version !== 1 ||
      !("draft" in stored)
    )
      return null;
    return valid(kind, stored.draft) ? stored.draft : null;
  } catch {
    return null;
  }
}

/** One named, explicitly resumed draft per flow on this shared device. */
export function saveMovementDraft<K extends keyof MovementDrafts>(
  kind: K,
  draft: MovementDrafts[K] | null,
): boolean {
  try {
    if (draft === null) window.localStorage.removeItem(`pendolino.${kind}`);
    else
      window.localStorage.setItem(
        `pendolino.${kind}`,
        JSON.stringify({ version: 1, draft }),
      );
    return true;
  } catch {
    return false;
  }
}
