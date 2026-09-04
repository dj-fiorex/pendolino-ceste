import type { IndexRange } from "convex/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { openCampagna } from "./campagne";
import { linksToMedia } from "./media";
import { requireAdmin } from "./operatori";
import {
  action,
  mediaLinks,
  plainMovimentoKind,
  type Action,
  type PlainMovimentoKind,
} from "./schema";

/**
 * The stretch of time a read of the Registro covers: `from` included, `to` not.
 *
 * A day, at the counter, is the mill's day, and only the device knows where it
 * starts — the two nights the clocks change are 23 and 25 hours long. So the
 * screen turns the date somebody picked into these two instants, and the query
 * takes them as given.
 */
export const day = v.object({ from: v.number(), to: v.number() });

type Day = Infer<typeof day>;

/**
 * What narrows a read of the Registro. All four are optional, and a read with
 * none of them is the whole Registro, which no screen asks for: the screen
 * always names a day.
 */
const filters = {
  day: v.optional(day),
  clienteId: v.optional(v.id("clienti")),
  operatoreId: v.optional(v.id("operatori")),
  // The actions that left a Rettifica behind them, or the ones that did not:
  // "show me where the app was wrong on Tuesday" is a question the mill has
  // never been able to ask (#21).
  producedRettifica: v.optional(v.boolean()),
};

type Filters = Infer<ReturnType<typeof v.object<typeof filters>>>;

/**
 * Writes the one Registro row that names the action a person just took.
 *
 * Called from inside the mutation making the change, never scheduled and never
 * a mutation of its own, so that the change and the row it is recorded under
 * cannot exist without each other (ADR-0006). Hands back the row's id, which
 * every Movimento the same action produces carries (#16).
 *
 * The Campagna is settled here rather than by each caller, so that no mutation
 * has to remember to say which season its row belongs to (#19).
 */
export async function writeRegistroRow(
  ctx: MutationCtx,
  row: {
    operatoreId: Id<"operatori">;
    /** The Cliente the action concerns, where it concerns one. */
    clienteId?: Id<"clienti">;
    /**
     * The Campagna the action belongs to, where the mutation has already
     * settled it: a Movimento at the counter, which stamps the same one on
     * every Cesta it moves, and an action on a Campagna herself, which is
     * about the one it names rather than the one that happens to be open.
     *
     * Every other action takes the Campagna the mill has open, and belongs to
     * none while the mill has none open. Only the counter screens ask an
     * Operatore which season their work belongs to, so only the Movimenti they
     * record can carry a Campagna that is closed.
     */
    campagnaId?: Id<"campagne">;
    /**
     * Whether the action is about to write a Rettifica: an Admin recording one
     * on a Cesta, or the counter correcting what the app believed as a
     * movement goes through (#21). Settled by the caller before the row is
     * written, because the Rettifiche hang off the row and the row cannot name
     * them afterwards without being edited (ADR-0004).
     *
     * Every other action leaves none, and says so by saying nothing.
     */
    producedRettifica?: boolean;
    /**
     * The row this one corrects: the action a Rettifica of *errore* says was
     * registered wrongly (#28). Every other action corrects none.
     */
    corrects?: Id<"registro">;
    action: Action;
  },
): Promise<Id<"registro">> {
  const campagnaId = row.campagnaId ?? (await openCampagna(ctx))?._id;
  return await ctx.db.insert("registro", {
    ...row,
    campagnaId,
    producedRettifica: row.producedRettifica ?? false,
  });
}

/**
 * As much of a Convex index range builder as bounding a day needs: every index
 * carries `_creationTime` last, so this is what all three of ours offer once
 * their own fields have been matched.
 */
type CreationTimeRange = IndexRange & {
  gte(
    field: "_creationTime",
    value: number,
  ): { lt(field: "_creationTime", value: number): IndexRange };
};

/**
 * The day as a range on that `_creationTime`, whether the index leads on the
 * Cliente, on the Operatore or on nothing at all. A read with no day is every
 * row of the index.
 */
const within = <Range extends CreationTimeRange>(
  q: Range,
  day: Day | undefined,
): IndexRange =>
  day === undefined
    ? q
    : q.gte("_creationTime", day.from).lt("_creationTime", day.to);

/**
 * Whether a row left a Rettifica behind it. The rows written before the flag
 * existed left none that anything can say for them, and read as such (#21).
 */
const leftARettifica = (row: Doc<"registro">) => row.producedRettifica ?? false;

/**
 * The rows a set of filters leaves, newest first.
 *
 * Whether the action left a Rettifica sifts what the indexes hand back rather
 * than leading on an index of its own, because the screen always names a day
 * and a day is a handful of rows. A read that names no day reads the whole
 * Registro to answer it, which is the same cost that read already had.
 */
async function rowsMatching(
  ctx: QueryCtx,
  filters: Filters,
): Promise<Doc<"registro">[]> {
  const rows = await rowsIndexedBy(ctx, filters);
  return filters.producedRettifica === undefined
    ? rows
    : rows.filter((row) => leftARettifica(row) === filters.producedRettifica);
}

/**
 * The rows the three indexed filters leave, newest first.
 *
 * Whichever of the Cliente and the Operatore is asked for leads on its own
 * index; the other, on the rare read that asks for both, sifts the handful of
 * rows that come back. With neither, the day is a range read on the built-in
 * index — and that is the read the screen makes all day.
 */
async function rowsIndexedBy(
  ctx: QueryCtx,
  { day, clienteId, operatoreId }: Filters,
): Promise<Doc<"registro">[]> {
  if (clienteId !== undefined) {
    const rows = await ctx.db
      .query("registro")
      .withIndex("by_cliente", (q) => within(q.eq("clienteId", clienteId), day))
      .order("desc")
      .collect();
    return operatoreId === undefined
      ? rows
      : rows.filter((row) => row.operatoreId === operatoreId);
  }

  if (operatoreId !== undefined) {
    return await ctx.db
      .query("registro")
      .withIndex("by_operatore", (q) =>
        within(q.eq("operatoreId", operatoreId), day),
      )
      .order("desc")
      .collect();
  }

  return await ctx.db
    .query("registro")
    .withIndex("by_creation_time", (q) => within(q, day))
    .order("desc")
    .collect();
}

/** The Operatore a row names, who is deactivated but never deleted (ADR-0004). */
async function operatoreOf(
  ctx: QueryCtx,
  row: Doc<"registro">,
): Promise<Doc<"operatori">> {
  const operatore = await ctx.db.get(row.operatoreId);
  if (operatore === null) {
    throw new Error("A Registro row names an Operatore that is gone.");
  }
  return operatore;
}

/**
 * The Campagna a row belongs to, as she is named now: renaming a Campagna
 * renames the season, and the rows recorded in it read under the new name.
 * The rows written before the app knew about Campagne belong to none (#19).
 */
async function campagnaNameOf(
  ctx: QueryCtx,
  row: Doc<"registro">,
): Promise<string | null> {
  if (row.campagnaId === undefined) {
    return null;
  }
  const campagna = await ctx.db.get(row.campagnaId);
  return campagna?.name ?? null;
}

/**
 * The kinds of row a Rettifica of *errore* is ever written against: the three
 * movements somebody registers at the counter or in the yard, read off the
 * Movimento's own union rather than listed again here. A Censimento or a
 * Campagna opened is not put right by a Rettifica, and no read looks for one
 * against them.
 */
const CORRECTABLE: PlainMovimentoKind[] = plainMovimentoKind.members.map(
  (member) => member.value,
);

/** Whether a row names one of them, and so has a correction to be read for. */
const isCorrectable = (kind: Action["kind"]): kind is PlainMovimentoKind =>
  CORRECTABLE.some((correctable) => correctable === kind);

/**
 * The action a row corrects, where it is the Rettifica of an *errore*: which
 * of the three movements was registered wrongly, and when it was written down.
 */
async function correctsOf(ctx: QueryCtx, row: Doc<"registro">) {
  if (row.corrects === undefined) {
    return null;
  }
  const corrected = await ctx.db.get(row.corrects);
  if (corrected === null) {
    // A Registro row is never deleted (ADR-0004).
    throw new Error("A Rettifica names a Registro row that is gone.");
  }
  const kind = corrected.action.kind;
  if (!isCorrectable(kind)) {
    throw new Error(
      "A Rettifica corrects a Ritiro, a Rientro or a Svuotamento.",
    );
  }
  return { _id: corrected._id, at: corrected._creationTime, kind };
}

/**
 * The Rettifiche that correct a row, and which Cesta each of them was about.
 *
 * Read from their end rather than the row's, because a correction is written
 * days after the action it corrects and the corrected row is never rewritten
 * to point back at it (ADR-0004). One indexed read per row that could be
 * corrected, over a day the screen already holds; there are at most as many
 * corrections as the action moved Ceste, and a Ritiro moves six.
 */
async function correctedByOf(ctx: QueryCtx, row: Doc<"registro">) {
  if (!isCorrectable(row.action.kind)) {
    return [];
  }
  const corrections = await ctx.db
    .query("registro")
    .withIndex("by_corrects", (q) => q.eq("corrects", row._id))
    .collect();
  return corrections.flatMap((correction) =>
    correction.action.kind === "rettifica"
      ? [
          {
            _id: correction._id,
            at: correction._creationTime,
            numero: correction.action.numero,
          },
        ]
      : [],
  );
}

/** The Cliente a row concerns, where it concerns one. Never deleted either. */
async function clienteOf(
  ctx: QueryCtx,
  row: Doc<"registro">,
): Promise<Doc<"clienti"> | null> {
  if (row.clienteId === undefined) {
    return null;
  }
  const cliente = await ctx.db.get(row.clienteId);
  if (cliente === null) {
    throw new Error("A Registro row names a Cliente that is gone.");
  }
  return cliente;
}

/**
 * The Registro, newest first: who did what, when, and to which Cliente, as the
 * structured fields the screen turns into Italian sentences. Read by an Admin
 * only (spec #1).
 *
 * The Cliente comes back as the registry has them now, not as they were named
 * that day, because "who is this" is a question about the person. Where a row
 * turns on the name itself — a Cliente created, a Cliente deactivated — the
 * action carries the name as it was written (ADR-0004).
 */
export const list = query({
  args: filters,
  returns: v.array(
    v.object({
      _id: v.id("registro"),
      at: v.number(),
      operatore: v.string(),
      cliente: v.union(
        v.null(),
        v.object({ name: v.string(), alias: v.array(v.string()) }),
      ),
      // The Campagna the action belonged to, and nobody on the rows that
      // predate the mill's first one.
      campagna: v.union(v.null(), v.string()),
      // Whether the action left a Rettifica behind it, so that the screen can
      // mark the row and offer the day's discrepanze on their own (#21, #27).
      producedRettifica: v.boolean(),
      // The action this row corrects, and the Rettifiche that correct it: the
      // two ends of a misregistration put right, so that the Registro reads
      // the pair from whichever of them the Admin happens to be looking at
      // (#28). Every row that is neither says so with a null and an empty
      // list.
      corrects: v.union(
        v.null(),
        v.object({
          _id: v.id("registro"),
          at: v.number(),
          kind: plainMovimentoKind,
        }),
      ),
      correctedBy: v.array(
        v.object({
          _id: v.id("registro"),
          at: v.number(),
          // The Cesta the correction was about, because an action moves several
          // and only one of them was the mistake.
          numero: v.number(),
        }),
      ),
      // What a Ritiro carried besides its Ceste, to be looked at from here as
      // well as from each Cesta's own page — this is the screen on which a
      // Ritiro of six is the one line a person did, so it is where one
      // signature and one photograph most obviously belong (ADR-0006, #25).
      // Every other kind of action carried neither.
      media: mediaLinks,
      action,
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await rowsMatching(ctx, args);
    return await Promise.all(
      rows.map(async (row) => {
        const operatore = await operatoreOf(ctx, row);
        const cliente = await clienteOf(ctx, row);
        return {
          _id: row._id,
          at: row._creationTime,
          operatore: operatore.name,
          cliente:
            cliente === null
              ? null
              : { name: cliente.name, alias: cliente.alias },
          campagna: await campagnaNameOf(ctx, row),
          producedRettifica: leftARettifica(row),
          corrects: await correctsOf(ctx, row),
          correctedBy: await correctedByOf(ctx, row),
          media: await linksToMedia(ctx, row.action),
          action: row.action,
        };
      }),
    );
  },
});

/**
 * The Clienti and the Operatori that appear in a stretch of the Registro: what
 * the screen offers to narrow it by.
 *
 * Drawn from the rows themselves, so that no filter the screen offers ever
 * comes back empty, and read unnarrowed, so that picking one Cliente does not
 * take the others out of the list.
 */
export const filterOptions = query({
  args: { day: v.optional(day) },
  returns: v.object({
    clienti: v.array(
      v.object({
        _id: v.id("clienti"),
        name: v.string(),
        alias: v.array(v.string()),
      }),
    ),
    operatori: v.array(v.object({ _id: v.id("operatori"), name: v.string() })),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await rowsMatching(ctx, { day: args.day });

    const clienti = new Map<Id<"clienti">, Doc<"clienti">>();
    const operatori = new Map<Id<"operatori">, Doc<"operatori">>();
    for (const row of rows) {
      const operatore = await operatoreOf(ctx, row);
      operatori.set(operatore._id, operatore);
      const cliente = await clienteOf(ctx, row);
      if (cliente !== null) {
        clienti.set(cliente._id, cliente);
      }
    }

    const byName = (one: { name: string }, other: { name: string }) =>
      one.name.localeCompare(other.name, "it");
    return {
      clienti: [...clienti.values()]
        .map((cliente) => ({
          _id: cliente._id,
          name: cliente.name,
          alias: cliente.alias,
        }))
        .sort(byName),
      operatori: [...operatori.values()]
        .map((operatore) => ({ _id: operatore._id, name: operatore.name }))
        .sort(byName),
    };
  },
});
