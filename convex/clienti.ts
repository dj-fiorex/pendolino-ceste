import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import {
  comparableName,
  forma,
  MAX_SEARCH_RESULTS,
  namesakeClash,
  namesakesOf,
  portata,
  tidy,
} from "./schema";

/** A Cliente as every screen shows them: the name, the Alias, the telephone. */
const clienteShape = {
  _id: v.id("clienti"),
  name: v.string(),
  alias: v.array(v.string()),
  phone: v.union(v.null(), v.string()),
};

const asCliente = (cliente: Doc<"clienti">) => ({
  _id: cliente._id,
  name: cliente.name,
  alias: cliente.alias,
  phone: cliente.phone,
});

/**
 * The whole registry, by name, deactivated Clienti included.
 *
 * Read whole and matched in memory rather than through a search index. The
 * mill's registry is a few hundred names on one counter, and matching here
 * finds a fragment anywhere in a name or an Alias — which is how somebody
 * types when they half-remember a Soprannome. A registry that ever grows to
 * thousands is the point to revisit it.
 */
async function allClienti(ctx: QueryCtx): Promise<Doc<"clienti">[]> {
  return await ctx.db.query("clienti").withIndex("by_name").collect();
}

/**
 * The registry a picker, a search or a count reads: only the Clienti still in
 * play. A deactivated Cliente appears on the Lista di recupero until their
 * Ceste come back, and nowhere else (ADR-0004).
 */
async function activeClienti(ctx: QueryCtx): Promise<Doc<"clienti">[]> {
  return (await allClienti(ctx)).filter((cliente) => cliente.active);
}

/** The Ceste a Cliente is holding right now, by numero. */
async function cesteFuoriOf(
  ctx: QueryCtx,
  clienteId: Id<"clienti">,
): Promise<Doc<"ceste">[]> {
  const ceste = await ctx.db
    .query("ceste")
    .withIndex("by_cliente_and_state", (q) =>
      q.eq("clienteId", clienteId).eq("state", "fuori"),
    )
    .collect();
  return ceste.sort((one, other) => one.numero - other.numero);
}

/**
 * Refuses a Cliente that nothing would tell apart from the namesakes already
 * in the registry.
 *
 * Refuses rather than merges, and leaves the counter a way through — an Alias,
 * or picking the Cliente already there — because the app does not decide that
 * two people are one.
 */
function refuseANamesake(
  clienti: Doc<"clienti">[],
  cliente: { _id?: Id<"clienti">; name: string; alias: string[] },
): void {
  const namesakes = namesakesOf(
    clienti.filter((other) => other._id !== cliente._id),
    cliente.name,
  );
  switch (namesakeClash(cliente.alias, namesakes)) {
    case "no_alias":
      throw new Error(
        "A Cliente of this name is already in the registry: pick them, or tell this one apart with an Alias.",
      );
    case "shared_alias":
      throw new Error(
        "A Cliente of this name already answers to that Alias: nothing would tell the two apart.",
      );
    case null:
      return;
  }
}

/**
 * The Clienti whose name or Alias carries what the Operatore has typed. An
 * empty term is the whole registry, so that the same box browses and searches.
 */
export const search = query({
  args: { term: v.string() },
  returns: v.array(v.object(clienteShape)),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const wanted = comparableName(args.term);
    const clienti = await activeClienti(ctx);
    return clienti
      .filter((cliente) =>
        [cliente.name, ...cliente.alias].some((name) =>
          comparableName(name).includes(wanted),
        ),
      )
      .slice(0, MAX_SEARCH_RESULTS)
      .map(asCliente);
  },
});

/**
 * The Clienti already answering to a name, in play or not, so that the screen
 * can offer the one that is already there rather than let a returning Cliente
 * get a second record (spec #1, story 59). A deactivated namesake is nobody's
 * to pick, and is shown as the reason a Soprannome is needed.
 */
export const namesakes = query({
  args: { name: v.string() },
  returns: v.array(v.object({ ...clienteShape, active: v.boolean() })),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    if (tidy(args.name) === "") {
      return [];
    }
    return namesakesOf(await allClienti(ctx), args.name).map((cliente) => ({
      ...asCliente(cliente),
      active: cliente.active,
    }));
  },
});

/**
 * A new Cliente, entered at the counter while the queue waits: a name is
 * enough, and the Alias and the telephone are added if the Cliente offers
 * them.
 */
export const create = mutation({
  args: {
    name: v.string(),
    alias: v.optional(v.array(v.string())),
    phone: v.optional(v.string()),
  },
  returns: v.id("clienti"),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);
    const name = tidy(args.name);
    const alias = (args.alias ?? []).map(tidy).filter((one) => one !== "");
    const phone = tidy(args.phone ?? "");
    refuseANamesake(await allClienti(ctx), { name, alias });

    const clienteId = await ctx.db.insert("clienti", {
      name,
      alias,
      phone: phone === "" ? null : phone,
      // The one-way mirror fills this in when it exists (ADR-0003); until then
      // a Cliente entered at the counter answers to no Gestionale record.
      gestionaleId: null,
      active: true,
    });

    await writeRegistroRow(ctx, operatore._id, {
      kind: "cliente_creato",
      clienteId,
      name,
    });

    return clienteId;
  },
});

/**
 * A correction to the registry: the name misheard at the counter, a Soprannome
 * the Cliente offers on the second visit, the telephone they finally give.
 * Every Operatore can make it — waiting for an Admin is how a registry goes
 * stale (spec #1, story 53).
 *
 * The Cliente is given whole, as the form holds them, and the Registro row
 * names only what actually changed, with before and after (ADR-0006, #27).
 */
export const update = mutation({
  args: {
    clienteId: v.id("clienti"),
    name: v.string(),
    alias: v.array(v.string()),
    phone: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      throw new Error("This Cliente is not in the registry.");
    }
    const phone = tidy(args.phone);
    const wanted = {
      name: tidy(args.name),
      alias: args.alias.map(tidy).filter((one) => one !== ""),
      phone: phone === "" ? null : phone,
    };
    refuseANamesake(await allClienti(ctx), {
      _id: cliente._id,
      ...wanted,
    });

    const changes = [
      { field: "name" as const, before: cliente.name, after: wanted.name },
      { field: "alias" as const, before: cliente.alias, after: wanted.alias },
      { field: "phone" as const, before: cliente.phone, after: wanted.phone },
    ].filter(
      (change) =>
        JSON.stringify(change.before) !== JSON.stringify(change.after),
    );
    if (changes.length === 0) {
      // Nothing changed is nothing to record.
      return null;
    }

    await ctx.db.patch(cliente._id, wanted);
    await writeRegistroRow(ctx, operatore._id, {
      kind: "cliente_modificato",
      clienteId: cliente._id,
      changes,
    });
    return null;
  },
});

/**
 * One Cliente, with the Ceste they are holding: the Cliente's own page, and
 * what an Admin is shown before deactivating somebody who still has Ceste out.
 *
 * A deactivated Cliente reads back here — they stay on the Lista di recupero
 * until their Ceste come back (ADR-0004) — where a search would not offer them.
 */
export const get = query({
  args: { clienteId: v.id("clienti") },
  returns: v.union(
    v.null(),
    v.object({
      ...clienteShape,
      active: v.boolean(),
      cesteFuori: v.array(
        v.object({
          _id: v.id("ceste"),
          numero: v.number(),
          codice: v.string(),
          portata,
          forma,
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      return null;
    }
    return {
      ...asCliente(cliente),
      active: cliente.active,
      cesteFuori: (await cesteFuoriOf(ctx, cliente._id)).map((cesta) => ({
        _id: cesta._id,
        numero: cesta.numero,
        codice: cesta.codice,
        portata: cesta.portata,
        forma: cesta.forma,
      })),
    };
  },
});

/**
 * An Admin takes a Cliente out of play: no search offers them and no picker
 * lists them again. They are never deleted (ADR-0004), and the Ceste they are
 * still holding stay with them and stay on the Lista di recupero until a
 * Rientro or a Rettifica brings them back (#22).
 *
 * That is why deactivating somebody holding Ceste is a two-step act: the app
 * shows an Admin exactly which Ceste it is writing off with them, and goes
 * ahead only when they say so.
 */
export const deactivate = mutation({
  args: {
    clienteId: v.id("clienti"),
    // The Admin has seen the Ceste this Cliente is still holding and means to
    // deactivate them anyway.
    confirmed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      throw new Error("This Cliente is not in the registry.");
    }
    const cesteFuori = await cesteFuoriOf(ctx, cliente._id);
    if (cesteFuori.length > 0 && !args.confirmed) {
      throw new Error(
        "This Cliente is still holding Ceste: deactivating them needs a confirmation.",
      );
    }

    await ctx.db.patch(cliente._id, { active: false });
    await writeRegistroRow(ctx, admin._id, {
      kind: "cliente_disattivato",
      clienteId: cliente._id,
      name: cliente.name,
      numeriFuori: cesteFuori.map((cesta) => cesta.numero),
    });
    return null;
  },
});
