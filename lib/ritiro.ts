import type { Id } from "@/convex/_generated/dataModel";
import { expectedBefore, type MediaKind } from "@/convex/schema";
import { whereTheAppHasHer, type FoundCesta } from "@/lib/ceste";
import type { Cliente } from "@/lib/cliente";
import { mediaKinds } from "@/lib/media";
import type { RitiroDraft } from "@/lib/ritiro-draft";

/** Files belong to this Ritiro in memory only; drafts carry their kinds. */
export type CapturedMedia = Readonly<Record<MediaKind, Blob | null>>;
const nothingCaptured: CapturedMedia = Object.freeze({
  signature: null,
  photo: null,
});

type Work = Readonly<{
  phase: "editing" | "recording";
  cliente: Cliente | null;
  ceste: readonly FoundCesta[];
  captured: CapturedMedia;
  toRetake: readonly MediaKind[];
  failed: boolean;
  mustAsk: boolean;
  canConfirm: boolean;
}>;

export type RitiroState =
  | Readonly<{ phase: "loading" }>
  | Readonly<{ phase: "offering"; draft: RitiroDraft }>
  | Work
  | Readonly<{
      phase: "recorded";
      cliente: Cliente;
      count: number;
      notUploaded: readonly MediaKind[];
    }>;

export type RecordRitiro = {
  clienteId: Id<"clienti">;
  cesteIds: Id<"ceste">[];
  campagnaId?: Id<"campagne">;
  signatureId?: Id<"_storage">;
  photoId?: Id<"_storage">;
};

type Dependencies = {
  drafts: {
    read: () => RitiroDraft | null;
    write: (draft: RitiroDraft) => void;
    clear: () => void;
  };
  upload: (file: Blob) => Promise<Id<"_storage">>;
  record: (ritiro: RecordRitiro) => Promise<unknown>;
};
export type RitiroCampagna = Readonly<{
  campagnaId?: Id<"campagne">;
  mustAsk: boolean;
}>;

const emptyWork = (): Work => ({
  phase: "editing",
  cliente: null,
  ceste: [],
  captured: nothingCaptured,
  toRetake: [],
  failed: false,
  mustAsk: false,
  canConfirm: false,
});

// Explicit fields keep runtime extras, including any files, out of drafts.
const copyCliente = (cliente: Cliente): Cliente => {
  const copy = {
    _id: cliente._id,
    name: cliente.name,
    alias: [...cliente.alias],
    phone: cliente.phone,
    smsOptOut: cliente.smsOptOut,
  };
  Object.freeze(copy.alias);
  return Object.freeze(copy);
};
const copyCesta = (cesta: FoundCesta): FoundCesta =>
  Object.freeze({
    _id: cesta._id,
    numero: cesta.numero,
    codice: cesta.codice,
    portata: cesta.portata,
    state: cesta.state,
    cliente: cesta.cliente === null ? null : copyCliente(cesta.cliente),
  });

/** The unfinished Ritiro owns recovery and recording order, independently of React. */
export class Ritiro {
  private state: RitiroState = { phase: "loading" };
  private listeners = new Set<() => void>();
  private missing: readonly MediaKind[] = [];
  private captureVersion: Record<MediaKind, number> = {
    signature: 0,
    photo: 0,
  };
  private inFlight: Promise<void> | null = null;
  private uploaded: Partial<
    Record<MediaKind, { file: Blob; id: Id<"_storage"> }>
  > = {};
  private campagna: RitiroCampagna = { mustAsk: false };
  private visible = false;

  constructor(private readonly dependencies: Dependencies) {}

  getSnapshot = (): RitiroState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: RitiroState) {
    if (state.phase === "editing" || state.phase === "recording") {
      const { captured } = state;
      state = {
        ...state,
        mustAsk: this.campagna.mustAsk,
        canConfirm:
          state.phase === "editing" &&
          state.cliente !== null &&
          state.ceste.length > 0 &&
          !this.campagna.mustAsk,
        toRetake: this.missing.filter((kind) => captured[kind] === null),
      };
      Object.freeze(state.ceste);
      Object.freeze(state.captured);
      Object.freeze(state.toRetake);
    }
    if (state.phase === "recorded") Object.freeze(state.notUploaded);
    this.state = Object.freeze(state);
    this.listeners.forEach((listener) => listener());
  }

  private clearDraft() {
    try {
      this.dependencies.drafts.clear();
    } catch {
      /* Best effort, including after recording. */
    }
  }

  private invalidateCaptures() {
    for (const kind of mediaKinds) this.captureVersion[kind]++;
  }

  private edit(work: Work) {
    const next: Work = {
      ...work,
    };
    if (next.ceste.length === 0) this.clearDraft();
    else if (next.cliente !== null) {
      try {
        this.dependencies.drafts.write({
          cliente: copyCliente(next.cliente),
          ceste: next.ceste.map(copyCesta),
          notKept: mediaKinds.filter(
            (kind) =>
              next.captured[kind] !== null || this.missing.includes(kind),
          ),
        });
      } catch {
        /* A failed save must not lose the Ritiro in memory. */
      }
    }
    this.publish(next);
  }

  /** Safe to call again when React reconnects an effect. */
  open = () => {
    this.visible = true;
    if (this.state.phase !== "loading") return;
    let draft: RitiroDraft | null = null;
    try {
      draft = this.dependencies.drafts.read();
    } catch {
      /* Storage is optional. */
    }
    if (draft === null) this.publish(emptyWork());
    else {
      const offered = {
        cliente: copyCliente(draft.cliente),
        ceste: draft.ceste.map(copyCesta),
        notKept: [...draft.notKept],
      };
      Object.freeze(offered.ceste);
      Object.freeze(offered.notKept);
      this.publish({ phase: "offering", draft: Object.freeze(offered) });
    }
  };

  /** Leaving the page keeps its draft, but must not start a second confirmation. */
  close = () => {
    this.visible = false;
    if (this.state.phase === "recording") return;
    this.invalidateCaptures();
    this.uploaded = {};
    this.missing = [];
    this.publish({ phase: "loading" });
  };

  /** Campagna choice is shared with the other movement screens. */
  setCampagna = (choice: RitiroCampagna) => {
    this.campagna = { ...choice };
    if (this.state.phase === "editing" || this.state.phase === "recording")
      this.publish(this.state);
  };

  resume = () => {
    if (this.state.phase !== "offering") return;
    const { draft } = this.state;
    this.missing = draft.notKept;
    this.edit({
      ...emptyWork(),
      cliente: copyCliente(draft.cliente),
      ceste: draft.ceste.map(copyCesta),
    });
  };

  abandon = () => {
    if (this.state.phase !== "offering" && this.state.phase !== "editing")
      return;
    this.missing = [];
    this.invalidateCaptures();
    this.uploaded = {};
    this.clearDraft();
    this.publish(emptyWork());
  };

  changeCliente = () => {
    if (this.state.phase !== "editing") return;
    this.invalidateCaptures();
    this.uploaded = {};
    this.missing = [];
    this.edit({ ...this.state, cliente: null, captured: nothingCaptured });
  };

  chooseCliente = (cliente: Cliente) => {
    if (this.state.phase !== "editing") return;
    // Also protect callers that replace a Cliente directly instead of opening search.
    if (this.state.cliente?._id !== cliente._id) this.changeCliente();
    this.edit({ ...this.state, cliente: copyCliente(cliente) });
  };

  /** Call before awaiting preparation so the result belongs to this Cliente. */
  capture = async (kind: MediaKind, prepared: Blob | Promise<Blob>) => {
    const accepted =
      this.state.phase === "editing" && this.state.cliente !== null;
    const version = ++this.captureVersion[kind];
    const file = await prepared;
    if (
      !accepted ||
      version !== this.captureVersion[kind] ||
      this.state.phase !== "editing"
    )
      return;
    delete this.uploaded[kind];
    this.edit({
      ...this.state,
      captured: { ...this.state.captured, [kind]: file },
    });
  };

  removeCesta = (id: Id<"ceste">) => {
    if (this.state.phase !== "editing") return;
    this.edit({
      ...this.state,
      ceste: this.state.ceste.filter((cesta) => cesta._id !== id),
    });
  };

  removeMedia = (kind: MediaKind) => {
    if (this.state.phase !== "editing") return;
    this.captureVersion[kind]++;
    delete this.uploaded[kind];
    this.edit({
      ...this.state,
      captured: { ...this.state.captured, [kind]: null },
    });
  };

  startAnother = () => {
    if (this.state.phase !== "recorded") return;
    this.missing = [];
    this.invalidateCaptures();
    this.uploaded = {};
    this.publish(emptyWork());
  };

  confirm = (): Promise<void> => {
    if (this.inFlight !== null) return this.inFlight;
    if (
      this.state.phase !== "editing" ||
      !this.state.canConfirm ||
      this.state.cliente === null
    ) {
      return Promise.resolve();
    }
    const work = this.state;
    const cliente = this.state.cliente;
    const { campagnaId } = this.campagna;
    this.invalidateCaptures();
    // Assign the attempt before notifying subscribers, including synchronous callers.
    this.inFlight = Promise.resolve().then(async () => {
      const notUploaded: MediaKind[] = [];
      const put = async (kind: MediaKind) => {
        const file = work.captured[kind];
        if (file === null) return undefined;
        const previous = this.uploaded[kind];
        if (previous?.file === file) return previous.id;
        try {
          const id = await this.dependencies.upload(file);
          this.uploaded[kind] = { file, id };
          return id;
        } catch {
          notUploaded.push(kind);
          return undefined;
        }
      };
      try {
        const signatureId = await put("signature");
        const photoId = await put("photo");
        await this.dependencies.record({
          clienteId: cliente._id,
          cesteIds: work.ceste.map((cesta) => cesta._id),
          campagnaId,
          signatureId,
          photoId,
        });
        this.clearDraft();
        this.uploaded = {};
        this.publish({
          phase: "recorded",
          cliente,
          count: work.ceste.length,
          notUploaded,
        });
      } catch {
        this.publish({ ...work, phase: "editing", failed: true });
        if (!this.visible) this.close();
      } finally {
        this.inFlight = null;
      }
    });
    this.publish({
      ...work,
      phase: "recording",
      failed: false,
      canConfirm: false,
    });
    return this.inFlight;
  };

  addCesta = (cesta: FoundCesta): string | null => {
    if (this.state.phase !== "editing" || this.state.cliente === null)
      return null;
    if (this.state.ceste.some((added) => added._id === cesta._id)) {
      return `${cesta.codice} è già nell'elenco.`;
    }
    this.edit({
      ...this.state,
      ceste: [...this.state.ceste, copyCesta(cesta)],
    });
    if (cesta.state === expectedBefore.ritiro) return null;
    return cesta.state === "dismessa"
      ? `${cesta.codice} risulta Dismessa: la registro lo stesso, ma torna a contare solo con una Rettifica di un Admin.`
      : `${cesta.codice} risulta ${whereTheAppHasHer(cesta)}: la registro lo stesso, con una Rettifica.`;
  };
}
