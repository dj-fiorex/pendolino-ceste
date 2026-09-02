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

/**
 * The size of the printed Etichetta, out of the sizes a print shop cuts as a
 * matter of course. The Forma is not one of these: it belongs to the Cesta and
 * is chosen at Censimento (ADR-0007).
 */
export const etichettaSize = v.union(
  v.literal("100x150"),
  v.literal("a6"),
  v.literal("70x100"),
);

export type Portata = Infer<typeof portata>;
export type Forma = Infer<typeof forma>;
export type State = Infer<typeof state>;
export type EtichettaSize = Infer<typeof etichettaSize>;

/**
 * The most a mill's name or telephone can be. They are printed across the foot
 * of a label 70 mm wide: past this they no longer fit on one line.
 */
export const MAX_MILL_TEXT = 40;

/**
 * What an Etichetta says besides the Cesta's own Codice: how big it is printed,
 * and whether the mill's name and telephone go on it. One set for the whole
 * mill, so the table, the mutation that writes it and the browser that draws
 * the label all take their shape from here.
 */
export const etichettaSettingsFields = {
  etichettaSize,
  millName: v.string(),
  millNameOnEtichetta: v.boolean(),
  millPhone: v.string(),
  millPhoneOnEtichetta: v.boolean(),
};

export type EtichettaSettings = Infer<
  ReturnType<typeof v.object<typeof etichettaSettingsFields>>
>;

/**
 * The settings that decide what an Etichetta looks like, each one named so
 * that a Registro row can say which of them an Admin changed.
 */
export const etichettaSettingField = v.union(
  v.literal("etichettaSize"),
  v.literal("millName"),
  v.literal("millNameOnEtichetta"),
  v.literal("millPhone"),
  v.literal("millPhoneOnEtichetta"),
);

export type EtichettaSettingField = Infer<typeof etichettaSettingField>;

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
  v.object({
    kind: v.literal("etichette_settings"),
    // Only the settings that actually changed, each with what it said before
    // and what it says now (#27).
    changes: v.array(
      v.object({
        field: etichettaSettingField,
        before: v.union(v.string(), v.boolean()),
        after: v.union(v.string(), v.boolean()),
      }),
    ),
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

  // What the whole mill has settled on, as one row and no more: the Etichetta
  // the print shop prints, and, when #22 arrives, the Soglia di ritardo beside
  // it. An empty table means nobody has changed anything yet, and every setting
  // reads as the app's own.
  settings: defineTable(etichettaSettingsFields),

  // One row per action a person took, however many Ceste it moved (ADR-0006).
  registro: defineTable({
    operatoreId: v.id("operatori"),
    action,
  }),
});
