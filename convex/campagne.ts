import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import { tidy } from "./schema";

/** A Campagna as the header at the counter and the Admin screen read her. */
const campagnaShape = {
  _id: v.id("campagne"),
  name: v.string(),
  openedAt: v.number(),
  // Nothing while she is still open, which is what "open" means here.
  closedAt: v.union(v.null(), v.number()),
};

/**
 * The Campagna the mill has open, or nobody where none is.
 *
 * At most one is ever open, which the mutation that opens one enforces. This
 * reads the first of them rather than refusing to answer if ever there were
 * two: every Movimento at the counter comes through here, and the counter is
 * never blocked (ADR-0005).
 */
export async function openCampagna(
  ctx: QueryCtx,
): Promise<Doc<"campagne"> | null> {
  return await ctx.db
    .query("campagne")
    .withIndex("by_closedAt", (q) => q.eq("closedAt", null))
    .first();
}

/**
 * The Campagna an action belongs to: the one the mill has open, or, when it
 * has none, the one this device names — the choice the app asked its Operatore
 * for once and has shown in the header ever since (#19).
 *
 * Naming one is not opening it: a closed Campagna picked at the counter stays
 * closed, and only an Admin ever opens one. An action recorded while the mill
 * has no Campagna at all belongs to none, and is recorded all the same: the
 * counter is not blocked by the calendar either (ADR-0005).
 */
export async function campagnaFor(
  ctx: QueryCtx,
  named: Id<"campagne"> | undefined,
): Promise<Id<"campagne"> | undefined> {
  const open = await openCampagna(ctx);
  if (open !== null) {
    return open._id;
  }
  if (named === undefined) {
    return undefined;
  }
  // A device naming a Campagna that is not there — one from another
  // deployment, say — names nobody rather than stopping the Movimento.
  return (await ctx.db.get(named))?._id;
}

/** The Campagna a mutation was asked to act on. */
async function requireCampagna(
  ctx: QueryCtx,
  campagnaId: Id<"campagne">,
): Promise<Doc<"campagne">> {
  const campagna = await ctx.db.get(campagnaId);
  if (campagna === null) {
    throw new Error("This Campagna is not one of the mill's.");
  }
  return campagna;
}

/** A name as a Campagna is stored under it, refusing one that says nothing. */
function requireName(name: string): string {
  const wanted = tidy(name);
  if (wanted === "") {
    throw new Error("A Campagna needs a name to be picked by.");
  }
  return wanted;
}

/**
 * The Ceste still out with somebody, by numero: what an Admin closing a
 * Campagna is shown, and what the row recording the close carries.
 */
async function cesteFuori(ctx: QueryCtx): Promise<Doc<"ceste">[]> {
  const ceste = await ctx.db
    .query("ceste")
    .withIndex("by_state", (q) => q.eq("state", "fuori"))
    .collect();
  return ceste.sort((one, other) => one.numero - other.numero);
}

/**
 * Every Campagna the mill has had, newest first: what the Admin screen manages
 * and what the counter picks from when none is open. Read by every Operatore,
 * because the header shows the Campagna their Movimenti are going into.
 */
export const list = query({
  args: {},
  returns: v.array(v.object(campagnaShape)),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const campagne = await ctx.db.query("campagne").order("desc").collect();
    return campagne.map((campagna) => ({
      _id: campagna._id,
      name: campagna.name,
      openedAt: campagna.openedAt,
      closedAt: campagna.closedAt,
    }));
  },
});

/**
 * An Admin opens the season, and every Movimento recorded from now on belongs
 * to it. At most one Campagna is open at a time, refused here rather than only
 * hidden on the screen (spec #1, story 40).
 */
export const open = mutation({
  args: { name: v.string() },
  returns: v.id("campagne"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = requireName(args.name);
    const alreadyOpen = await openCampagna(ctx);
    if (alreadyOpen !== null) {
      throw new Error(
        `The Campagna ${alreadyOpen.name} is still open: close it before opening another.`,
      );
    }

    const campagnaId = await ctx.db.insert("campagne", {
      name,
      openedAt: Date.now(),
      closedAt: null,
    });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      campagnaId,
      action: { kind: "campagna_aperta", name },
    });
    return campagnaId;
  },
});

/**
 * An Admin corrects what a Campagna is called. The name is the Campagna's
 * alone: the Movimenti recorded against her read under the new one, because
 * they belong to the season and not to the string it was typed as (spec #1).
 *
 * The Registro row carries the name before and after (#27, ADR-0006), and a
 * name saved unchanged is nothing that happened.
 */
export const rename = mutation({
  args: { campagnaId: v.id("campagne"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const campagna = await requireCampagna(ctx, args.campagnaId);
    const after = requireName(args.name);
    if (after === campagna.name) {
      return null;
    }

    await ctx.db.patch(campagna._id, { name: after });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      campagnaId: campagna._id,
      action: {
        kind: "campagna_rinominata",
        before: campagna.name,
        after,
      },
    });
    return null;
  },
});

/**
 * An Admin closes the season. Closing is bookkeeping over Movimenti and
 * nothing more: no Cesta is touched here, because a Cesta at a Cliente's house
 * does not come home for a register being closed (spec #1, story 42).
 *
 * An Admin closing while Ceste are still out is shown exactly which ones and
 * who holds them, and goes ahead only by saying so — the same confirmation a
 * Cliente holding Ceste needs before being deactivated, and for the same
 * reason: the Ceste stay out either way (ADR-0004).
 */
export const close = mutation({
  args: {
    campagnaId: v.id("campagne"),
    // The Admin has seen the Ceste still Fuori and means to close anyway.
    confirmed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const campagna = await requireCampagna(ctx, args.campagnaId);
    if (campagna.closedAt !== null) {
      throw new Error("This Campagna is already closed.");
    }
    const fuori = await cesteFuori(ctx);
    if (fuori.length > 0 && !args.confirmed) {
      throw new Error(
        "Ceste are still Fuori: closing the Campagna needs a confirmation.",
      );
    }

    await ctx.db.patch(campagna._id, { closedAt: Date.now() });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      campagnaId: campagna._id,
      action: {
        kind: "campagna_chiusa",
        name: campagna.name,
        numeriFuori: fuori.map((cesta) => cesta.numero),
      },
    });
    return null;
  },
});

/**
 * An Admin puts back a Campagna closed by mistake, so that the season's
 * Movimenti stay together (spec #1, story 61). Refused while another Campagna
 * is open, which is the same single-open rule opening one obeys.
 */
export const reopen = mutation({
  args: { campagnaId: v.id("campagne") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const campagna = await requireCampagna(ctx, args.campagnaId);
    if (campagna.closedAt === null) {
      throw new Error("This Campagna is already open.");
    }
    const alreadyOpen = await openCampagna(ctx);
    if (alreadyOpen !== null) {
      throw new Error(
        `The Campagna ${alreadyOpen.name} is open: close it before reopening another.`,
      );
    }

    await ctx.db.patch(campagna._id, { closedAt: null });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      campagnaId: campagna._id,
      action: { kind: "campagna_riaperta", name: campagna.name },
    });
    return null;
  },
});
