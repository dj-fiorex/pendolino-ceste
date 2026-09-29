import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { fuoriSince } from "./movimenti";
import { requireAdmin, requireOperatore } from "./operatori";
import { readPhone } from "./phone";
import { writeRegistroRow } from "./registro";
import {
  comparableName,
  forma,
  indexedNames,
  MAX_SEARCH_RESULTS,
  namesakeClash,
  portata,
  properName,
  searchableNames,
  tidy,
} from "./schema";

/** Match word boundaries, including apostrophes and hyphens, like the index. */
const searchWords = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

function matchesEveryWord(cliente: Doc<"clienti">, wanted: string[]): boolean {
  const words = searchWords(searchableNames(cliente));
  return wanted.every((term, index) =>
    words.some((word) =>
      index === wanted.length - 1 ? word.startsWith(term) : word === term,
    ),
  );
}

/** A Cliente as every screen shows them: the name, the Alias, the telephone. */
export const clienteShape = {
  _id: v.id("clienti"),
  name: v.string(),
  alias: v.array(v.string()),
  phone: v.union(v.null(), v.string()),
  // Whether the mill writes to them. Answered here rather than left absent, so
  // that no screen has to know that a Cliente entered before the app sent any
  // Sms simply says nothing about it.
  smsOptOut: v.boolean(),
};

export const asCliente = (cliente: Doc<"clienti">) => ({
  _id: cliente._id,
  name: cliente.name,
  alias: cliente.alias,
  phone: cliente.phone,
  smsOptOut: cliente.smsOptOut === true,
});

/**
 * A telephone as the registry keeps it: E.164, or nothing where the Cliente
 * gave none. A number that reads as neither is refused (ADR-0009).
 *
 * The refusal never reaches a Cliente who simply has no telephone: the field
 * may be empty, and leaving it empty is what keeps the counter moving while a
 * queue waits. What it refuses is four digits and a shrug — at the moment the
 * Operatore can still ask the man in front of them.
 */
function phoneToStore(typed: string): string | null {
  const reading = readPhone(typed);
  if (reading.kind === "unreadable") {
    throw new Error(
      "This telephone is not a number anybody could call: write it in full, or leave it empty.",
    );
  }
  return reading.kind === "empty" ? null : reading.e164;
}

/**
 * The Clienti already answering to a name, deactivated ones included, read
 * straight off `by_comparableName`.
 *
 * This is the one read in the app that collects without a bound, and it is
 * bounded by the rule it serves: two Clienti never share a name with no Alias
 * to tell them apart, so a name reaches as many rows as the counter has
 * Soprannomi for it — the mill's worst is eight men called Cipolla Giuseppe.
 * The whole registry is never in the answer.
 */
async function namesakesOf(
  ctx: QueryCtx,
  name: string,
): Promise<Doc<"clienti">[]> {
  return await ctx.db
    .query("clienti")
    .withIndex("by_comparableName", (q) =>
      q.eq("comparableName", comparableName(name)),
    )
    .collect();
}

/** Namesakes read by name, then by who was entered first. */
const byName = (one: Doc<"clienti">, other: Doc<"clienti">) =>
  comparableName(one.name).localeCompare(comparableName(other.name)) ||
  one._creationTime - other._creationTime;

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
async function refuseANamesake(
  ctx: QueryCtx,
  cliente: { _id?: Id<"clienti">; name: string; alias: string[] },
): Promise<void> {
  const namesakes = (await namesakesOf(ctx, cliente.name)).filter(
    (other) => other._id !== cliente._id,
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
 * One page of indexed candidates, exposing only Clienti matching every word.
 * The final word may be a prefix. A short or empty page is not the end unless
 * `isDone` says so: the picker continues from the candidate cursor, preserving
 * matches beyond the first twenty OR hits. Rejected candidates become null,
 * so the picker can count the native 1024-candidate ceiling without receiving
 * their details. Empty input browses the registry.
 * Inactive Clienti are excluded by the index before pagination (ADR-0004).
 */
export const search = query({
  args: { term: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.union(v.null(), v.object(clienteShape))),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const wanted = comparableName(args.term);
    const words = searchWords(wanted);
    if (wanted !== "" && words.length === 0) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > MAX_SEARCH_RESULTS
    ) {
      throw new Error("Request between 1 and 20 search candidates per page.");
    }
    // Preserve native cursor/split metadata. Reactive pages can grow beyond
    // numItems, so also cap their scan. Ordinary browse pages can be split;
    // search uses its native candidate ceiling and cursor behavior.
    const paginationOpts = {
      ...args.paginationOpts,
      maximumRowsRead: Math.min(
        args.paginationOpts.maximumRowsRead ?? 100,
        100,
      ),
      maximumBytesRead: Math.min(
        args.paginationOpts.maximumBytesRead ?? 262144,
        262144,
      ),
    };
    const found =
      wanted === ""
        ? // Nothing typed yet. A search index has no answer to an empty
          // question, so browsing is the first page of the registry itself.
          await ctx.db
            .query("clienti")
            .withIndex("by_active_and_name", (q) => q.eq("active", true))
            .paginate(paginationOpts)
        : await ctx.db
            .query("clienti")
            .withSearchIndex("search_names", (q) =>
              // Convex accepts at most sixteen search terms. A subset is a
              // candidate superset; the predicate below still checks them all.
              q
                .search("searchableNames", words.slice(0, 16).join(" "))
                .eq("active", true),
            )
            .paginate(paginationOpts);
    return {
      ...found,
      page: found.page.map((cliente) =>
        matchesEveryWord(cliente, words) ? asCliente(cliente) : null,
      ),
    };
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
    return (await namesakesOf(ctx, args.name)).sort(byName).map((cliente) => ({
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
  returns: v.object(clienteShape),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);
    // The name in the registry's own casing, the Alias in the counter's. A
    // Soprannome is what somebody is called rather than what they are named,
    // and "u' pilota" shouted back as "U' Pilota" is not the same word.
    const name = properName(args.name);
    const alias = (args.alias ?? []).map(tidy).filter((one) => one !== "");
    const phone = phoneToStore(args.phone ?? "");
    await refuseANamesake(ctx, { name, alias });

    const clienteId = await ctx.db.insert("clienti", {
      name,
      alias,
      phone,
      // The one-way mirror fills this in when it exists (ADR-0003); until then
      // a Cliente entered at the counter answers to no Gestionale record.
      gestionaleId: null,
      active: true,
      ...indexedNames({ name, alias }),
    });

    await writeRegistroRow(ctx, {
      operatoreId: operatore._id,
      clienteId,
      action: { kind: "cliente_creato", name },
    });

    const cliente = await ctx.db.get("clienti", clienteId);
    if (cliente === null) {
      throw new Error("The newly created Cliente could not be read.");
    }
    return asCliente(cliente);
  },
});

/**
 * A correction to the registry: the name misheard at the counter, a Soprannome
 * the Cliente offers on the second visit, the telephone they finally give.
 * Every Operatore can make it — waiting for an Admin is how a registry goes
 * stale (spec #1, story 53).
 *
 * The Cliente is given whole, as the form holds them, and the Registro row
 * names only what actually changed, with before and after (ADR-0006).
 */
export const update = mutation({
  args: {
    clienteId: v.id("clienti"),
    name: v.string(),
    alias: v.array(v.string()),
    phone: v.string(),
    // Whether this Cliente has asked not to be written to. Corrected by every
    // Operatore, like the rest of the registry: nobody can reply to an Sms the
    // app sends, so "basta messaggi" is only ever said to whoever is at the
    // counter, and they have to be able to act on it there.
    smsOptOut: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      throw new Error("This Cliente is not in the registry.");
    }
    const wanted = {
      name: properName(args.name),
      alias: args.alias.map(tidy).filter((one) => one !== ""),
      phone: phoneToStore(args.phone),
      smsOptOut: args.smsOptOut,
    };
    await refuseANamesake(ctx, {
      _id: cliente._id,
      ...wanted,
    });

    const changes = [
      { field: "name" as const, before: cliente.name, after: wanted.name },
      { field: "alias" as const, before: cliente.alias, after: wanted.alias },
      { field: "phone" as const, before: cliente.phone, after: wanted.phone },
      {
        field: "smsOptOut" as const,
        before: cliente.smsOptOut === true,
        after: wanted.smsOptOut,
      },
    ].filter(
      (change) =>
        JSON.stringify(change.before) !== JSON.stringify(change.after),
    );
    if (changes.length === 0) {
      // Nothing changed is nothing to record.
      return null;
    }

    await ctx.db.patch(cliente._id, { ...wanted, ...indexedNames(wanted) });
    await writeRegistroRow(ctx, {
      operatoreId: operatore._id,
      clienteId: cliente._id,
      action: { kind: "cliente_modificato", changes },
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
          // Since when she has been Fuori, so that the counter can say how
          // long she has been gone (#17, #22).
          since: v.union(v.null(), v.number()),
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
      cesteFuori: await Promise.all(
        (await cesteFuoriOf(ctx, cliente._id)).map(async (cesta) => ({
          _id: cesta._id,
          numero: cesta.numero,
          codice: cesta.codice,
          portata: cesta.portata,
          forma: cesta.forma,
          // The Ritiro that took her out, or the Rettifica that says she
          // turned up here — whichever last put her in his hands (#20).
          since: await fuoriSince(ctx, cesta._id),
        })),
      ),
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
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      clienteId: cliente._id,
      action: {
        kind: "cliente_disattivato",
        name: cliente.name,
        numeriFuori: cesteFuori.map((cesta) => cesta.numero),
      },
    });
    return null;
  },
});
