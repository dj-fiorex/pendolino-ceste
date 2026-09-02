import { defineSchema, defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

/** An Operatore is either plain counter staff or an Admin. */
export const role = v.union(v.literal("operatore"), v.literal("admin"));

/** The weight of olives a Cesta carries. The unit the counter counts in. */
export const portata = v.union(v.literal(400), v.literal(250));

/**
 * Quadrata or rettangolare, written Q or R in the Codice. It exists to be read
 * off the Etichetta: it never filters a list or splits a count (ADR-0007).
 */
export const forma = v.union(v.literal("quadrata"), v.literal("rettangolare"));

/**
 * Where a Cesta is. Held on the Cesta rather than replayed from her Movimenti,
 * because the counter is never blocked (ADR-0005) and so the Movimenti are a
 * record of events rather than a ledger that balances.
 */
export const state = v.union(
  v.literal("disponibile"),
  v.literal("fuori"),
  v.literal("attesa_molitura"),
  v.literal("dismessa"),
);

export type Portata = Infer<typeof portata>;
export type Forma = Infer<typeof forma>;
export type State = Infer<typeof state>;

/**
 * What a Registro row says was done, one member per kind of action. Every
 * mutation that changes the domain writes its row in the same transaction, and
 * each ticket adds its member here as it adds its mutation (ADR-0006). #27
 * builds the screen that reads them, and #19 adds the Campagna the action
 * belongs to.
 */
export const action = v.union(
  v.object({
    kind: v.literal("censimento"),
    portata,
    forma,
    count: v.number(),
    fromNumero: v.number(),
    toNumero: v.number(),
  }),
);

export type Action = Infer<typeof action>;

export default defineSchema({
  // The app's own staff record. Better Auth owns the credentials; the role and
  // the active flag are the app's own concern and live here (ADR-0008).
  operatori: defineTable({
    // The Better Auth user this record belongs to, as it appears in the
    // identity subject of a signed-in request.
    authUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role,
    active: v.boolean(),
  }).index("by_authUserId", ["authUserId"]),

  // The fleet. A Cesta's numero, portata, forma and codice are settled at
  // Censimento and never change afterwards, because the Etichetta is printed
  // (ADR-0007): no mutation edits them, and none deletes a Cesta (ADR-0004).
  ceste: defineTable({
    numero: v.number(),
    portata,
    forma,
    codice: v.string(),
    state,
    active: v.boolean(),
  })
    // Also the sequence: the highest numero handed out so far is the first row
    // of this index read backwards.
    .index("by_numero", ["numero"])
    .index("by_state", ["state"]),

  // One row per action a person took, however many Ceste it moved (ADR-0006).
  registro: defineTable({
    operatoreId: v.id("operatori"),
    action,
  }),
});
