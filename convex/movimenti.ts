import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { campagnaFor } from "./campagne";
import { linksToMedia, NO_MEDIA } from "./media";
import { requireAdmin, requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import {
  adminRettificaCause,
  expectedBefore,
  mediaFields,
  mediaLinks,
  movimentoKind,
  rettificaFields,
  rettificaLeaves,
  state,
  type AdminRettificaCause,
  type MediaLinks,
  type MovimentoKind,
  type PlainMovimentoKind,
  type State,
} from "./schema";

/**
 * When the newest Movimento of a kind against a Cesta happened, or nothing
 * where there is none. A Cesta is Fuori since her last Ritiro (#17, #22) and a
 * Cliente's stack has been waiting since their oldest Rientro (#18) — both are
 * this read.
 *
 * A Cesta that reached a state some other way has no such Movimento and says
 * so, rather than inventing a date: the Movimenti are a record of events, not
 * a ledger that balances (ADR-0005).
 */
export async function lastMovimentoAt(
  ctx: QueryCtx,
  cestaId: Id<"ceste">,
  kind: MovimentoKind,
): Promise<number | null> {
  return (await lastMovimento(ctx, cestaId, kind))?._creationTime ?? null;
}

/**
 * The signature and the photograph of the Ritiro a Movimento was part of, as
 * links to look at.
 *
 * Read from that Ritiro's Registro row, which is where one signature and one
 * photograph hang, because one Cliente signed once however many Ceste he
 * loaded (ADR-0006, #25). So one Cesta's page shows them beside her own
 * Ritiro, and the other five Ceste show the same pair beside theirs — never
 * six copies of either, and never twice on one page: the Rettifica of
 * *discrepanza* that shares the row is not the Ritiro and carries none.
 */
async function mediaLinksOf(
  ctx: QueryCtx,
  movimento: Doc<"movimenti">,
): Promise<MediaLinks> {
  if (movimento.kind !== "ritiro") {
    return NO_MEDIA;
  }
  const row = await ctx.db.get(movimento.registroId);
  // A Registro row is never deleted (ADR-0004), so this is belt and braces.
  return row === null ? NO_MEDIA : await linksToMedia(ctx, row.action);
}

/** What a Rettifica corrected, and nothing on every other kind of Movimento. */
const rettificaOf = (movimento: Doc<"movimenti">) =>
  movimento.kind === "rettifica" ? movimento.rettifica : null;

/** The newest Movimento of a kind against a Cesta, as a single indexed row. */
async function lastMovimento(
  ctx: QueryCtx,
  cestaId: Id<"ceste">,
  kind: MovimentoKind,
): Promise<Doc<"movimenti"> | null> {
  return await ctx.db
    .query("movimenti")
    .withIndex("by_cesta_and_kind", (q) =>
      q.eq("cestaId", cestaId).eq("kind", kind),
    )
    .order("desc")
    .first();
}

/**
 * The newest Rettifica against a Cesta that says she went out, and nothing
 * where none does.
 *
 * A correction of a misregistration is not one of them, whatever state it
 * leaves her in. It does not say she left the yard; it says the record of her
 * leaving named the wrong Cliente, or the wrong Cesta, or a Rientro that never
 * happened. The Ritiro it corrects is still the day she went (#28).
 *
 * Read newest first and stopped at the first that says so, so that an *errore*
 * written over a Rettifica that did put her out does not hide it.
 */
async function lastRettificaThatPutHerOut(
  ctx: QueryCtx,
  cestaId: Id<"ceste">,
): Promise<Doc<"movimenti"> | null> {
  const rettifiche = ctx.db
    .query("movimenti")
    .withIndex("by_cesta_and_kind", (q) =>
      q.eq("cestaId", cestaId).eq("kind", "rettifica"),
    )
    .order("desc");
  for await (const movimento of rettifiche) {
    const rettifica = rettificaOf(movimento);
    if (rettifica?.becomes === "fuori" && rettifica.cause !== "errore") {
      return movimento;
    }
  }
  return null;
}

/**
 * Since when a Cesta has been Fuori: what the counter reads as "Fuori dal 25
 * ott" and what the Lista di recupero sorts on (#22).
 *
 * Her last Ritiro, ordinarily — and the Rettifica that says she turned up at a
 * Cliente's, where that is newer, because a Cesta found in somebody's yard has
 * been theirs since the Admin said so and not since a Ritiro that may never
 * have happened (#20).
 *
 * A Ritiro on a Cesta the app already had Fuori writes a discrepanza that also
 * leaves her Fuori (#21). It lands in the same instant as the Ritiro beside it,
 * so the later of the two is that instant either way and this reads the same
 * answer whichever it picks.
 *
 * A correction of a misregistration moves neither end. A Cesta handed to the
 * wrong one of two namesakes has been out since the morning she was loaded,
 * and putting the right name on her in the afternoon must not read as her
 * having left today: the mill would chase the days it has already lost (#28).
 */
export async function fuoriSince(
  ctx: QueryCtx,
  cestaId: Id<"ceste">,
): Promise<number | null> {
  const ritiro = await lastMovimentoAt(ctx, cestaId, "ritiro");
  const putHerOut = await lastRettificaThatPutHerOut(ctx, cestaId);
  const since = [ritiro, putHerOut?._creationTime ?? null].filter(
    (at) => at !== null,
  );
  return since.length === 0 ? null : Math.max(...since);
}

/**
 * The two movements at the counter, each as what it is called and where it
 * leaves the Ceste it moved. Everything else about them is one gesture — the
 * Cliente in front of the Operatore, then their Ceste one at a time — which is
 * why one function records both.
 *
 * The Svuotamento is not one of these: nobody is at the counter for it and it
 * carries no Cliente.
 */
const atTheCounter = {
  ritiro: { name: "Ritiro", becomes: "fuori" },
  rientro: { name: "Rientro", becomes: "attesa_molitura" },
} as const satisfies Record<string, { name: string; becomes: State }>;

type CounterMovimento = keyof typeof atTheCounter;

/**
 * The Campagna the device recording a Movimento names: the choice the app
 * asked its Operatore for once, because the mill has none open, and has shown
 * in the header ever since (#19). The open Campagna wins over it, and a
 * Movimento goes through with neither.
 */
const campagnaArg = { campagnaId: v.optional(v.id("campagne")) };

/**
 * Whether a Cesta is one of the mill's. She is, unless an Admin has written her
 * off: Dismessa and out of the fleet are one fact in two fields, the state and
 * the active flag, and a Rettifica of *ritrovata* is what ever ends it (#20).
 *
 * No Movimento moves a Cesta that is out of the fleet, because putting her back
 * into it is an Admin's to record and whoever is at the counter or emptying
 * Ceste is not one. What happened is written down all the same: the Movimento
 * says she was there, and the Rettifica of *discrepanza* beside it says the app
 * did not have her, which is the whole of what it can honestly claim to know
 * (ADR-0005).
 */
const inTheFleet = (cesta: Doc<"ceste">) => cesta.state !== "dismessa";

/**
 * Whether a Cesta is where the Movimento about to move her expected to find
 * her: where `expectedBefore` says, and, on a Rientro, with the very Cliente
 * driving her back.
 *
 * The Cliente counts on a Rientro because "she is out with somebody else" is
 * the same size of surprise as "she was never out at all": either way the app
 * was wrong about whose she was, and a Cesta the app believes belongs to Tizio
 * coming back on Caio's trailer is exactly the fact the mill has never been
 * able to see (ADR-0005).
 *
 * Nothing refuses her for the answer. All it decides is whether a Rettifica of
 * *discrepanza* is written beside the Movimento, saying what the app believed
 * at the time.
 */
const asExpected = (
  kind: PlainMovimentoKind,
  cesta: Doc<"ceste">,
  /** The Cliente at the counter, where there is one. */
  clienteId?: Id<"clienti">,
) =>
  cesta.state === expectedBefore[kind] &&
  (kind !== "rientro" || cesta.clienteId === clienteId);

/** What either movement at the counter is: a Cliente, and the Ceste added. */
const counterArgs = {
  clienteId: v.id("clienti"),
  cesteIds: v.array(v.id("ceste")),
  ...campagnaArg,
};

/**
 * A movement at the counter: the Ceste the Operatore has added, one at a time,
 * all move together under the Cliente in front of them. One Movimento per
 * Cesta, all of them under the one Registro row that says what the Operatore
 * did (ADR-0006).
 *
 * Nothing here refuses a Cesta for the state she is in — Fuori with somebody
 * else, still in Attesa molitura, or never taken out at all. The Cesta is in
 * the yard and the Cliente is loading her: the app records what happens rather
 * than authorising it, and a Cesta on the wrong trailer is exactly the fact the
 * mill has never been able to see (ADR-0005). Each of those Ceste moves with a
 * Rettifica of *discrepanza* beside her, carrying the belief the movement went
 * through on, and the Operatore is told before they confirm rather than after.
 *
 * The Cliente moved to is always the one actually present, which is what makes
 * a Rientro of somebody else's Cesta come to rest under the name the paper tape
 * will carry (#17).
 */
async function recordAtTheCounter(
  ctx: MutationCtx,
  kind: CounterMovimento,
  args: {
    clienteId: Id<"clienti">;
    cesteIds: Id<"ceste">[];
    campagnaId?: Id<"campagne">;
    /**
     * What a Ritiro carries beside its Ceste, where the Operatore took
     * anything: the Cliente's signature and the photograph of his load, both
     * already in file storage (#25). A Rientro takes neither — nobody signs
     * for bringing Ceste back.
     */
    signatureId?: Id<"_storage">;
    photoId?: Id<"_storage">;
  },
): Promise<null> {
  const { name, becomes } = atTheCounter[kind];
  const operatore = await requireOperatore(ctx);
  // Settled once for the whole movement, so that the Registro row and every
  // Movimento under it name the same season (ADR-0006).
  const campagnaId = await campagnaFor(ctx, args.campagnaId);
  const cliente = await ctx.db.get(args.clienteId);
  if (cliente === null) {
    throw new Error("This Cliente is not in the registry.");
  }

  // The same Cesta added twice — scanned and then typed, say — is one Cesta
  // moved once.
  const cesteIds = [...new Set(args.cesteIds)];
  if (cesteIds.length === 0) {
    throw new Error(`A ${name} takes at least one Cesta.`);
  }
  const ceste = await Promise.all(cesteIds.map((id) => ctx.db.get(id)));
  if (ceste.some((cesta) => cesta === null)) {
    throw new Error(`A Cesta in this ${name} is not in the fleet.`);
  }
  const inFleet = ceste.flatMap((cesta) => (cesta === null ? [] : [cesta]));

  // Which of them the app was wrong about, settled before any of them moves:
  // the Registro row says whether the action produced a Rettifica, and the row
  // is written first, because every Movimento under it carries its id.
  const surprises = new Set(
    inFleet
      .filter((cesta) => !asExpected(kind, cesta, cliente._id))
      .map((cesta) => cesta._id),
  );

  const numeri = inFleet.map((cesta) => cesta.numero).sort((a, b) => a - b);
  const registroId = await writeRegistroRow(ctx, {
    operatoreId: operatore._id,
    clienteId: cliente._id,
    campagnaId,
    producedRettifica: surprises.size > 0,
    // The signature and the photograph go on the row and nowhere else: one
    // Cliente signed once, whether he loaded one Cesta or six (ADR-0006, #25).
    action:
      kind === "ritiro"
        ? {
            kind,
            numeri,
            signatureId: args.signatureId,
            photoId: args.photoId,
          }
        : { kind, numeri },
  });

  for (const cesta of inFleet) {
    // Where the movement leaves her: with the Cliente at the counter, unless an
    // Admin has written her off, in which case it moves nothing. She is
    // Dismessa, standing in the yard, and only an Admin's *ritrovata* brings
    // her back into the fleet (#20).
    const leavesHer = inTheFleet(cesta) ? becomes : cesta.state;
    if (surprises.has(cesta._id)) {
      // She was not where the app had her, and she is moving all the same.
      // Written before the Movimento and under the same Registro row, as the
      // Svuotamento's is (ADR-0006), and naming the Cliente the app believed
      // was holding her, so that the correction turns up in that Cliente's own
      // history — which is where the mill would go looking for why a Cesta
      // stopped being counted against them.
      await ctx.db.insert("movimenti", {
        kind: "rettifica",
        cestaId: cesta._id,
        clienteId: cesta.clienteId,
        operatoreId: operatore._id,
        campagnaId,
        registroId,
        rettifica: {
          cause: "discrepanza",
          believedState: cesta.state,
          becomes: leavesHer,
        },
      });
    }
    if (inTheFleet(cesta)) {
      await ctx.db.patch(cesta._id, {
        state: leavesHer,
        clienteId: cliente._id,
      });
    }
    await ctx.db.insert("movimenti", {
      kind,
      cestaId: cesta._id,
      clienteId: cliente._id,
      operatoreId: operatore._id,
      campagnaId,
      registroId,
    });
  }
  return null;
}

/**
 * A Ritiro: the Ceste the Operatore has added go out with the Cliente at the
 * counter, and the mill can answer who is holding what.
 */
export const ritiro = mutation({
  // The two the Ritiro alone takes: whatever the Operatore captured before
  // confirming, already uploaded, and neither of them where they captured
  // nothing — which is most mornings, and is what optional means here (#25).
  args: { ...counterArgs, ...mediaFields },
  returns: v.null(),
  handler: (ctx, args) => recordAtTheCounter(ctx, "ritiro", args),
});

/**
 * A Rientro: the Cliente drives back in with a load of full Ceste, and they
 * come to rest in Attesa molitura, where the paper tape in the yard already
 * says they are.
 *
 * What comes back is what the Operatore added, and nothing else moves: the two
 * Ceste of six that stayed on the farm are still Fuori afterwards, still
 * counted against the same Cliente. There is no code here about partial
 * returns, because a partial return is only a Rientro of fewer Ceste (#17).
 */
export const rientro = mutation({
  args: counterArgs,
  returns: v.null(),
  handler: (ctx, args) => recordAtTheCounter(ctx, "rientro", args),
});

/**
 * A Svuotamento: the Ceste selected on the tile screen are tipped out, their
 * paper tapes come off, and every one of them is Disponibile again — all on
 * one tap, because a stack of eight is one gesture and not eight.
 *
 * No Cliente anywhere. The load stops being anybody's the moment it is in the
 * mill, and so does the Cesta the moment she is empty. Whoever is signed in on
 * the device is the Operatore the Registro names: there is no station account
 * (#18).
 *
 * A Cesta the app did not believe to be in Attesa molitura is emptied all the
 * same, with a Rettifica beside her carrying the belief it corrected. She is
 * standing full in the mill whatever the app thinks — her Rientro was never
 * registered, or she never went out at all — and refusing her would only send
 * somebody with olives on their hands back to the counter (ADR-0005).
 */
export const svuotamento = mutation({
  args: { cesteIds: v.array(v.id("ceste")), ...campagnaArg },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);
    const campagnaId = await campagnaFor(ctx, args.campagnaId);

    // The same Cesta twice — tapped on her tile and then typed on the keypad —
    // is one Cesta emptied once.
    const cesteIds = [...new Set(args.cesteIds)];
    if (cesteIds.length === 0) {
      throw new Error("A Svuotamento takes at least one Cesta.");
    }
    const ceste = await Promise.all(cesteIds.map((id) => ctx.db.get(id)));
    if (ceste.some((cesta) => cesta === null)) {
      throw new Error("A Cesta in this Svuotamento is not in the fleet.");
    }
    const inFleet = ceste.flatMap((cesta) => (cesta === null ? [] : [cesta]));

    // The ones the app did not have waiting to be milled, settled before any
    // of them moves, for the same reason as at the counter.
    const surprises = new Set(
      inFleet
        .filter((cesta) => !asExpected("svuotamento", cesta))
        .map((cesta) => cesta._id),
    );

    const registroId = await writeRegistroRow(ctx, {
      operatoreId: operatore._id,
      campagnaId,
      producedRettifica: surprises.size > 0,
      action: {
        kind: "svuotamento",
        numeri: inFleet.map((cesta) => cesta.numero).sort((a, b) => a - b),
      },
    });

    for (const cesta of inFleet) {
      // Where the Svuotamento leaves her: empty and at the mill, unless an
      // Admin has written her off, in which case emptying her moves nothing.
      // She is Dismessa, standing empty in the yard, and the Rettifica below is
      // all that says she turned up at all — putting her back into the fleet is
      // an Admin's *ritrovata* and nobody else's (#20).
      const becomes = inTheFleet(cesta) ? "disponibile" : "dismessa";
      // Written before she moves, and under the same Registro row as the
      // Svuotamento that moved her: the correction and the movement are one
      // action a person took (ADR-0006).
      if (surprises.has(cesta._id)) {
        await ctx.db.insert("movimenti", {
          kind: "rettifica",
          cestaId: cesta._id,
          clienteId: cesta.clienteId,
          operatoreId: operatore._id,
          campagnaId,
          registroId,
          rettifica: {
            cause: "discrepanza",
            believedState: cesta.state,
            becomes,
          },
        });
      }
      // Empty, at the mill, in nobody's hands: the Cliente goes with the tape.
      if (inTheFleet(cesta)) {
        await ctx.db.patch(cesta._id, {
          state: becomes,
          clienteId: undefined,
        });
      }
      await ctx.db.insert("movimenti", {
        kind: "svuotamento",
        cestaId: cesta._id,
        operatoreId: operatore._id,
        campagnaId,
        registroId,
      });
    }
    return null;
  },
});

/**
 * The Movimento a Rettifica of *errore* corrects, read and checked, and nothing
 * on every other cause.
 *
 * It has to be one of this Cesta's own, because a correction is about what was
 * registered against her; and it has to be one of the three that happen in the
 * yard. A Rettifica is not corrected here: it does not say a Cesta moved, it
 * says where she is, and an Admin who wants to say otherwise records another
 * one about the Cesta rather than about a record of a movement.
 */
async function correctedMovimento(
  ctx: MutationCtx,
  cestaId: Id<"ceste">,
  args: { cause: AdminRettificaCause; corrects?: Id<"movimenti"> },
): Promise<Doc<"movimenti"> | null> {
  if (args.cause !== "errore") {
    if (args.corrects !== undefined) {
      throw new Error("Only a correction names the Movimento it corrects.");
    }
    return null;
  }
  if (args.corrects === undefined) {
    throw new Error("A correction names the Movimento registered wrongly.");
  }
  const movimento = await ctx.db.get(args.corrects);
  if (movimento === null || movimento.cestaId !== cestaId) {
    throw new Error("That Movimento was not registered against this Cesta.");
  }
  if (movimento.kind === "rettifica") {
    throw new Error("A correction is of a Ritiro, a Rientro or a Svuotamento.");
  }
  return movimento;
}

/**
 * A Rettifica: an Admin says what became of a Cesta that no Ritiro and no
 * Rientro explains — she was lost to a Cliente, she broke at the mill, she
 * turned up again, or the last Movimento was registered wrongly and she is
 * really somewhere else — and the fleet is corrected to match.
 *
 * The cause is the point of the whole thing. A Cesta that simply stopped being
 * counted is a delete wearing a different hat, and losing one to a Cliente is a
 * different fact from breaking one in the yard: the mill counts them apart, and
 * asked for exactly that unprompted (ADR-0004). So the cause is required here
 * and required again on the Movimento, where the schema refuses a Rettifica
 * without one.
 *
 * An Admin only, like every act on the fleet — and the note is theirs to leave
 * or not.
 */
export const rettifica = mutation({
  args: {
    cestaId: v.id("ceste"),
    cause: adminRettificaCause,
    // The Cliente a *ritrovata* Cesta turned up at, and nobody when she turned
    // up at the mill; the one really holding a Cesta a correction leaves Fuori,
    // where naming somebody is not optional. No other cause names one: whom a
    // lost Cesta was with is what the app already believed, and the Rettifica
    // reads it from there.
    clienteId: v.optional(v.id("clienti")),
    // The Movimento an *errore* corrects, and the state the Cesta is really in
    // — both of them on that cause and on no other. The Movimento is read, not
    // touched: it stays exactly as it was registered (ADR-0004).
    corrects: v.optional(v.id("movimenti")),
    becomes: v.optional(state),
    note: v.optional(v.string()),
    ...campagnaArg,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const cesta = await ctx.db.get(args.cestaId);
    if (cesta === null) {
      throw new Error("This Cesta is not in the fleet.");
    }
    const corrected = await correctedMovimento(ctx, cesta._id, args);

    // Where the Rettifica leaves her: what the cause says by itself, or, on an
    // *errore*, the state the Admin says she is really in — which is the one
    // thing that cause cannot say for them, because the same slip at the
    // counter can leave a Cesta anywhere.
    if (args.cause !== "errore" && args.becomes !== undefined) {
      throw new Error("Only a correction says where the Cesta really is.");
    }
    const becomes =
      args.cause === "errore"
        ? args.becomes
        : rettificaLeaves(args.cause, args.clienteId !== undefined);
    if (becomes === undefined) {
      throw new Error("A correction says where the Cesta really is.");
    }
    if (becomes === "dismessa" && args.cause === "errore") {
      throw new Error(
        "A Cesta leaves the fleet as persa or as rotta, never as a correction.",
      );
    }

    // Whom she is really with. A Cesta that turned up may have turned up at the
    // mill or in somebody's hands; a Cesta a correction leaves Fuori is in
    // somebody's, because Fuori with nobody is not a place a Cesta can be.
    if (
      args.clienteId !== undefined &&
      args.cause !== "ritrovata" &&
      becomes !== "fuori"
    ) {
      throw new Error(
        "Only a Cesta that turned up again, or one a correction leaves Fuori, names a Cliente.",
      );
    }
    if (
      args.clienteId === undefined &&
      args.cause === "errore" &&
      becomes === "fuori"
    ) {
      throw new Error(
        "A Cesta a correction leaves Fuori is Fuori with somebody.",
      );
    }
    const found =
      args.clienteId === undefined ? null : await ctx.db.get(args.clienteId);
    if (args.clienteId !== undefined && found === null) {
      throw new Error("This Cliente is not in the registry.");
    }

    // A box the Admin left blank is no note, not an empty one.
    const written = args.note?.trim();
    const note = written === "" ? undefined : written;
    // Whose hands the Rettifica leaves her in. A Cesta at the mill is nobody's
    // — except in the yard, still full, where the paper tape carries the name
    // of whoever drove her in: correcting a Svuotamento tapped by mistake has
    // to put her back in his group on the Svuotamento screen, which is where
    // whoever is emptying will look for her (#18).
    const holds =
      becomes === "fuori"
        ? found?._id
        : becomes === "attesa_molitura"
          ? (await lastMovimento(ctx, cesta._id, "rientro"))?.clienteId
          : undefined;
    // Whom the correction concerns: the Cliente it leaves her with, or the one
    // the app believed was holding her — which is where the mill would go
    // looking for why a Cesta stopped being counted against somebody.
    const clienteId = holds ?? cesta.clienteId;
    const campagnaId = await campagnaFor(ctx, args.campagnaId);

    const registroId = await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      clienteId,
      campagnaId,
      // The one action that is a Rettifica rather than merely leaving one
      // behind: a read of the Registro for what produced a Rettifica finds the
      // Admin's own corrections beside the counter's discrepanze.
      producedRettifica: true,
      // The action this one corrects, so that the Registro reads the pair from
      // either end: the Rettifica names what was registered wrongly, and the
      // wrong action reads as corrected without being rewritten (ADR-0004).
      corrects: corrected?.registroId,
      action: {
        kind: "rettifica",
        numero: cesta.numero,
        cause: args.cause,
        becomes,
        note,
      },
    });
    await ctx.db.insert("movimenti", {
      kind: "rettifica",
      cestaId: cesta._id,
      clienteId,
      operatoreId: admin._id,
      campagnaId,
      registroId,
      rettifica: {
        cause: args.cause,
        believedState: cesta.state,
        becomes,
        corrects: corrected?._id,
        note,
      },
    });
    // The state and the active flag are one fact in two fields, and this is the
    // only mutation that ever parts a Cesta from the fleet or gives her back to
    // it.
    await ctx.db.patch(cesta._id, {
      state: becomes,
      clienteId: holds,
      active: becomes !== "dismessa",
    });
    return null;
  },
});

/**
 * One Cesta's own history, newest first: every Movimento recorded against her,
 * with the Cliente it named and the Operatore who registered it.
 *
 * This is where a Rettifica reads beside the Movimento that produced it — what
 * the app believed, kept next to what actually happened, which is the pair the
 * whole project exists to show (ADR-0005).
 */
export const byCesta = query({
  args: { cestaId: v.id("ceste") },
  returns: v.array(
    v.object({
      // Which Movimento this is, so that a Rettifica of *errore* can name the
      // one it corrects and her page can read the two beside each other (#28).
      _id: v.id("movimenti"),
      kind: movimentoKind,
      // The Cliente the Movimento named, and nobody where it named none.
      cliente: v.union(
        v.null(),
        v.object({ name: v.string(), alias: v.array(v.string()) }),
      ),
      operatore: v.string(),
      at: v.number(),
      // The Campagna the Movimento belonged to, as she is named now, and
      // nobody on the Movimenti recorded before the mill had one (#19).
      campagna: v.union(v.null(), v.string()),
      registroId: v.id("registro"),
      // What a Rettifica corrected, and nothing on every other kind.
      rettifica: v.union(v.null(), v.object(rettificaFields)),
      // What the Operatore took beside the Ceste of a Ritiro, where they took
      // anything: the signature and the photograph, to be looked at from here
      // for as long as the mill keeps them, which is for good (#25).
      media: mediaLinks,
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const movimenti = await ctx.db
      .query("movimenti")
      .withIndex("by_cesta", (q) => q.eq("cestaId", args.cestaId))
      .order("desc")
      .collect();
    return await Promise.all(
      movimenti.map(async (movimento) => {
        const operatore = await ctx.db.get(movimento.operatoreId);
        const cliente =
          movimento.clienteId === undefined
            ? null
            : await ctx.db.get(movimento.clienteId);
        const campagna =
          movimento.campagnaId === undefined
            ? null
            : await ctx.db.get(movimento.campagnaId);
        if (operatore === null) {
          // Neither an Operatore nor a Cliente is ever deleted (ADR-0004).
          throw new Error("A Movimento names an Operatore that is gone.");
        }
        return {
          _id: movimento._id,
          kind: movimento.kind,
          cliente:
            cliente === null
              ? null
              : { name: cliente.name, alias: cliente.alias },
          operatore: operatore.name,
          at: movimento._creationTime,
          campagna: campagna?.name ?? null,
          registroId: movimento.registroId,
          rettifica: rettificaOf(movimento),
          media: await mediaLinksOf(ctx, movimento),
        };
      }),
    );
  },
});

/**
 * Everything a Cliente's Ceste have done, newest first: what they took, when,
 * and which Operatore registered it. The Cliente's own page reads it, and it is
 * the answer to "we took four, not six" at the counter.
 */
export const byCliente = query({
  args: { clienteId: v.id("clienti") },
  returns: v.array(
    v.object({
      kind: movimentoKind,
      numero: v.number(),
      codice: v.string(),
      operatore: v.string(),
      at: v.number(),
      // The action this Movimento was part of, which the Registro groups by.
      registroId: v.id("registro"),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const movimenti = await ctx.db
      .query("movimenti")
      .withIndex("by_cliente", (q) => q.eq("clienteId", args.clienteId))
      .order("desc")
      .collect();
    return await Promise.all(
      movimenti.map(async (movimento) => {
        const cesta = await ctx.db.get(movimento.cestaId);
        const operatore = await ctx.db.get(movimento.operatoreId);
        if (cesta === null || operatore === null) {
          // Neither is ever deleted (ADR-0004).
          throw new Error(
            "A Movimento names a Cesta or an Operatore that is gone.",
          );
        }
        return {
          kind: movimento.kind,
          numero: cesta.numero,
          codice: cesta.codice,
          operatore: operatore.name,
          at: movimento._creationTime,
          registroId: movimento.registroId,
        };
      }),
    );
  },
});
