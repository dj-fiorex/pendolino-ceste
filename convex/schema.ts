import { defineSchema, defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

/** An Operatore is either plain counter staff or an Admin. */
export const role = v.union(v.literal("operatore"), v.literal("admin"));

export type Role = Infer<typeof role>;

/**
 * What Resend made of an email the app asked it to send: the moment it went
 * out, or the reason it did not.
 */
export const emailDelivered = v.union(
  v.object({ kind: v.literal("sent"), at: v.number() }),
  v.object({ kind: v.literal("failed"), at: v.number(), reason: v.string() }),
);

/** The same, and nothing at all while the send is still to be tried. */
export const emailDelivery = v.union(v.null(), ...emailDelivered.members);

export type EmailDelivery = Infer<typeof emailDelivery>;

/**
 * The shortest password the mill will take. Refused by the action that sets
 * one and said on the screen that asks for it, which is one rule in two voices
 * — the form tells you before you press, and the app refuses regardless.
 */
export const MIN_PASSWORD_LENGTH = 8;

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
 * What a Movimento is: one Cesta changing state on one occasion. The three
 * that happen in the yard, and the Rettifica that says what no Ritiro and no
 * Rientro explains — including the one written against a Movimento here,
 * because an *errore* corrects a movement that did happen (#28).
 */
export const plainMovimentoKind = v.union(
  v.literal("ritiro"),
  v.literal("rientro"),
  v.literal("svuotamento"),
);

export const movimentoKind = v.union(
  ...plainMovimentoKind.members,
  v.literal("rettifica"),
);

export type MovimentoKind = Infer<typeof movimentoKind>;

export type PlainMovimentoKind = Infer<typeof plainMovimentoKind>;

/**
 * Where each Movimento expects to find a Cesta before it moves her: at the
 * mill and empty for a Ritiro, out with a Cliente for a Rientro, back and
 * still full for a Svuotamento.
 *
 * Expects, and never requires. A Cesta anywhere else goes through all the
 * same, with a Rettifica of *discrepanza* beside her saying where the app had
 * her: the physical event is already under way, and a validation that refuses
 * it does not correct reality, it only removes the app from it (ADR-0005).
 *
 * One rule in two voices, as `rettificaLeaves` is: the mutation writes the
 * Rettifica by it, and the counter screens turn it into the line that warns the
 * Operatore before they confirm — a warning that neither stops nor gates them.
 */
export const expectedBefore = {
  ritiro: "disponibile",
  rientro: "fuori",
  svuotamento: "attesa_molitura",
} as const satisfies Record<PlainMovimentoKind, State>;

/**
 * The causes that say by themselves what became of a Cesta: one lost to a
 * Cliente, one broken at the mill, one that turned up again. Losing a Cesta
 * and breaking one are counted apart because they are apart — a reason is what
 * a Rettifica exists to attach (ADR-0004).
 */
export const settledRettificaCause = v.union(
  v.literal("persa"),
  v.literal("rotta"),
  v.literal("ritrovata"),
);

export type SettledRettificaCause = Infer<typeof settledRettificaCause>;

/**
 * The causes an Admin chooses from: the three above, and *errore*, which says
 * a Movimento was registered wrongly.
 *
 * *Errore* is the one cause that does not say where it leaves the Cesta. The
 * others are facts about her — she is lost, she is broken, she is back — and
 * each has one ending. A misregistration is a fact about the record instead,
 * and the same mistake can leave her anywhere: scanned onto a trailer she
 * never went on, attributed to the wrong one of two namesakes, or emptied on
 * screen while she stands full in the yard. So the Admin names the state she
 * is really in, and names the Movimento being corrected, which stays exactly
 * as it was written (ADR-0004).
 */
export const adminRettificaCause = v.union(
  ...settledRettificaCause.members,
  v.literal("errore"),
);

export type AdminRettificaCause = Infer<typeof adminRettificaCause>;

/**
 * Why a Rettifica was written: the four an Admin chooses, and *discrepanza*,
 * the one the app writes itself as a Movimento goes through on a Cesta that
 * was not where the app believed (ADR-0005). No Admin ever chooses that one,
 * which is why the mutation they record a Rettifica through takes the narrower
 * union and this one is what a Movimento carries.
 */
export const rettificaCause = v.union(
  ...adminRettificaCause.members,
  v.literal("discrepanza"),
);

export type RettificaCause = Infer<typeof rettificaCause>;

/**
 * What a Rettifica records besides the Cesta it is written against: why, where
 * the app believed the Cesta was, and where the correction leaves her.
 *
 * That belief is the fact the mill has never been able to see (ADR-0005), and
 * it is gone from the Cesta the instant she moves — so it is written down here
 * rather than worked out afterwards from a history that no longer holds it.
 */
export const rettificaFields = {
  cause: rettificaCause,
  // Where the app had her: the state she was in when the Admin corrected her,
  // and, on a discrepanza, the state the Movimento beside it went through on.
  believedState: state,
  // Where she is left. A Ritiro or a Rientro says where it leaves a Cesta by
  // being one; a Rettifica is the only Movimento whose name does not, so it
  // says so itself — and a discrepanza says where the Movimento beside it left
  // her, which is how "Fuori since" finds the correction that put her there.
  becomes: state,
  // The Movimento an *errore* corrects, and nothing on every other cause. The
  // wrong Movimento is not edited and not deleted (ADR-0004): the pair is the
  // record, one saying what was written down and the other what was the case.
  corrects: v.optional(v.id("movimenti")),
  // What the Admin wrote beside the cause, where they wrote anything. Never in
  // place of it: a Rettifica with no reason is a delete wearing a different hat
  // (ADR-0004).
  note: v.optional(v.string()),
};

export type Rettifica = Infer<
  ReturnType<typeof v.object<typeof rettificaFields>>
>;

/**
 * Where a Rettifica of each cause leaves the Cesta: one lost to a Cliente or
 * broken at the mill is out of the fleet, and one that turned up is back in it
 * — at the mill, or in the hands of the Cliente she turned up at.
 *
 * One rule in two voices, as the namesake rule is: the mutation moves the Cesta
 * by it, and the form turns it into the sentence that says what confirming will
 * do. It is also the whole of the way to Dismessa — no other mutation writes
 * that state, an *errore* included (spec #1, story 37).
 *
 * *Errore* is not asked here at all. It is the cause whose ending the Admin
 * names rather than the cause deciding, and the type says so.
 */
export const rettificaLeaves = (
  cause: SettledRettificaCause,
  /** Whether the Admin named the Cliente the Cesta turned up at. */
  withCliente: boolean,
): State =>
  cause !== "ritrovata" ? "dismessa" : withCliente ? "fuori" : "disponibile";

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
 * How many days a Cesta may be Fuori before she counts In ritardo, until an
 * Admin says otherwise. Ten, which is the mill's own guess at how long a
 * harvest sits at a Cliente's before somebody should be telephoned.
 *
 * It decides highlighting on the Lista di recupero and nothing else: being
 * late moves no Cesta and hides nobody (CONTEXT.md, #22).
 */
export const DEFAULT_SOGLIA_RITARDO = 10;

/**
 * What the whole mill has settled on: what an Etichetta says, and the Soglia
 * di ritardo the Lista di recupero highlights by. One row for all of it, so
 * the table, the mutations that write it and the screens that read it take
 * their shape from here.
 */
export const settingsFields = {
  ...etichettaSettingsFields,
  // Optional because a row can predate the setting: one written when the mill
  // had only Etichette to settle carries no Soglia, and reads as the app's own
  // ten rather than being rewritten to say so (ADR-0004). An Admin who sets
  // the Soglia writes it; nothing else does.
  sogliaRitardo: v.optional(v.number()),
};

/** The settings row as it is stored — the Soglia only where one was set. */
export type StoredSettings = Infer<
  ReturnType<typeof v.object<typeof settingsFields>>
>;

/** A value as it is stored: no leading, trailing or doubled spaces. */
export const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * A name as two Clienti are compared by it. "mario  rossi" and "Mario Rossi"
 * are one person at the counter, so neither case nor spacing tells two Clienti
 * apart.
 */
export const comparableName = (text: string) => tidy(text).toLowerCase();

/** How many Clienti a search hands back, on screen as in the query. */
export const MAX_SEARCH_RESULTS = 20;

/**
 * The Clienti already answering to a name. A deactivated one counts: they stay
 * on the Lista di recupero holding Ceste (ADR-0004), and two rows there that
 * nothing tells apart is the confusion this rule exists to prevent.
 */
export const namesakesOf = <T extends { name: string }>(
  clienti: T[],
  name: string,
) =>
  clienti.filter(
    (other) => comparableName(other.name) === comparableName(name),
  );

/** Why an Alias fails to tell a Cliente apart from their namesakes. */
export type NamesakeClash = "no_alias" | "shared_alias";

/**
 * Whether an Alias tells a Cliente apart from the namesakes they were entered
 * against, and if not, why: two Clienti never share a name and an Alias, and a
 * namesake with no Alias at all is the same person (CONTEXT.md).
 *
 * One rule in two voices: the mutation turns the answer into a refusal, the
 * form into the sentence that says what to type instead.
 */
export const namesakeClash = (
  alias: string[],
  namesakes: { alias: string[] }[],
): NamesakeClash | null => {
  if (namesakes.length === 0) {
    return null;
  }
  if (alias.length === 0) {
    return "no_alias";
  }
  const taken = new Set(
    namesakes.flatMap((namesake) => namesake.alias.map(comparableName)),
  );
  return alias.some((one) => taken.has(comparableName(one)))
    ? "shared_alias"
    : null;
};

/**
 * What can be corrected on a Cliente, each one named so that a Registro row
 * can say which of them an Operatore changed.
 */
export const clienteField = v.union(
  v.literal("name"),
  v.literal("alias"),
  v.literal("phone"),
);

export type ClienteField = Infer<typeof clienteField>;

/**
 * The mill's timezone. A day at the counter starts at midnight here, wherever
 * the device reading the Registro happens to be: the mill's Tuesday has to be
 * the same stretch of time for the Admin at the counter and for one looking at
 * the day from somewhere else.
 */
export const MILL_TIME_ZONE = "Europe/Rome";

/**
 * What the mill's clock reads at an instant, as the instant that reading would
 * be were the mill on UTC. The difference between the two is the mill's offset,
 * which is how the offset is read off the timezone rather than assumed.
 */
const millClockAt = (instant: number) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MILL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
};

/** Today at the mill, as `<input type="date">` writes a date. */
export const todayAtTheMill = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: MILL_TIME_ZONE });

/**
 * The two instants a day at the mill runs between: `from` included, `to` not.
 * The Registro is read a day at a time, and this is what a day is.
 *
 * Each end is found by asking what the mill's clock read at that date's
 * midnight UTC and moving by the difference, so the two nights a year the
 * clocks change come out 23 and 25 hours long rather than 24.
 */
export const dayBounds = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const startOf = (offsetInDays: number) => {
    const asIfTheMillWereOnUtc = Date.UTC(year, month - 1, date + offsetInDays);
    return (
      asIfTheMillWereOnUtc +
      (asIfTheMillWereOnUtc - millClockAt(asIfTheMillWereOnUtc))
    );
  };
  return { from: startOf(0), to: startOf(1) };
};

/**
 * What a Registro row says was done, one member per kind of action. Every
 * mutation that changes the domain writes its row in the same transaction, and
 * each ticket adds its member here as it adds its mutation (ADR-0006).
 *
 * The Operatore, the Cliente and the Campagna are not here: they are fields of
 * the row, so that the Registro reads for one of them through an index.
 * What is here is what the action alone knows.
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
    kind: v.literal("cliente_creato"),
    // The name as it was written that day: a later edit changes the Cliente,
    // never what this row says happened (ADR-0004).
    name: v.string(),
  }),
  v.object({
    kind: v.literal("cliente_modificato"),
    // Only what actually changed, each with what it said before and what it
    // says now.
    changes: v.array(
      v.object({
        field: clienteField,
        before: v.union(v.null(), v.string(), v.array(v.string())),
        after: v.union(v.null(), v.string(), v.array(v.string())),
      }),
    ),
  }),
  v.object({
    kind: v.literal("ritiro"),
    // The Ceste that went out, by numero, so that the Registro reads as the
    // Operatore would say it: "un Ritiro di 6 Ceste: 12, 45, 78…".
    numeri: v.array(v.number()),
  }),
  v.object({
    kind: v.literal("rientro"),
    // The Ceste that came back full, by numero. Four of the six that went out
    // is a Rientro of four, and the row says which four.
    numeri: v.array(v.number()),
  }),
  v.object({
    kind: v.literal("svuotamento"),
    // The Ceste tipped out, by numero. No Cliente anywhere on the row: the
    // tapes come off and the load is nobody's by the time it is milled (#18).
    numeri: v.array(v.number()),
  }),
  v.object({
    kind: v.literal("rettifica"),
    // The Cesta corrected, by numero, as every other row names its Ceste.
    numero: v.number(),
    // Only the causes an Admin chooses are here: the discrepanze the app
    // writes itself share the row of the Movimento that produced them and
    // never a row of their own (ADR-0006).
    cause: adminRettificaCause,
    // What became of her, which is what the row is read for: the cause says
    // why, this says where it left her.
    becomes: state,
    note: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("cliente_disattivato"),
    name: v.string(),
    // The Ceste the Cliente was still holding when the Admin went ahead: the
    // row says the warning was seen, not merely that somebody was deactivated.
    numeriFuori: v.array(v.number()),
  }),
  v.object({
    kind: v.literal("campagna_aperta"),
    // The name the season was opened under: a later rename changes the
    // Campagna, never what this row says happened (ADR-0004).
    name: v.string(),
  }),
  v.object({
    kind: v.literal("campagna_rinominata"),
    before: v.string(),
    after: v.string(),
  }),
  v.object({
    kind: v.literal("campagna_chiusa"),
    name: v.string(),
    // The Ceste still Fuori when the Admin went ahead: the row says the
    // warning was seen, and that closing moved none of them (#19).
    numeriFuori: v.array(v.number()),
  }),
  v.object({
    kind: v.literal("campagna_riaperta"),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("etichette_settings"),
    // Only the settings that actually changed, each with what it said before
    // and what it says now.
    changes: v.array(
      v.object({
        field: etichettaSettingField,
        before: v.union(v.string(), v.boolean()),
        after: v.union(v.string(), v.boolean()),
      }),
    ),
  }),
  v.object({
    kind: v.literal("soglia_ritardo"),
    // How many days a Cesta could be Fuori before she was called late, and how
    // many she can now. One field, so the row says it outright rather than
    // through a list of changes: the Soglia is one number for the whole mill.
    before: v.number(),
    after: v.number(),
  }),
  v.object({
    kind: v.literal("operatore_invitato"),
    // The person as the Admin wrote them down. An invitation is all there is
    // of them until they accept, so the row says who was asked and at which
    // address, rather than pointing at a staff record that does not exist yet.
    name: v.string(),
    email: v.string(),
    role,
  }),
  v.object({
    kind: v.literal("invito_accettato"),
    // Written under the person who accepted, who is an Operatore by the time
    // the row is written: this is the moment they joined the mill.
    name: v.string(),
    email: v.string(),
    role,
  }),
  v.object({
    kind: v.literal("operatore_reset_inviato"),
    name: v.string(),
    email: v.string(),
  }),
  v.object({
    kind: v.literal("operatore_promosso"),
    name: v.string(),
    // The role before and after, because a promotion is a change and the
    // Registro says what changed (#26, ADR-0006).
    before: role,
    after: role,
  }),
  v.object({
    kind: v.literal("operatore_disattivato"),
    // The name they were deactivated under: their Movimenti stay attributed to
    // them, and this row says when they stopped registering any (ADR-0004).
    name: v.string(),
  }),
);

export type Action = Infer<typeof action>;

/**
 * What every Movimento carries, whatever kind it is: the Cesta that moved, who
 * she moved to or from, who registered it, and which action it was part of.
 */
const movimentoFields = {
  cestaId: v.id("ceste"),
  // The Cliente the Cesta moved to or from, where there is one. A Ritiro and a
  // Rientro always name the Cliente at the counter. A Svuotamento names nobody:
  // the Cesta is tipped out at the mill and her tape comes off. A Rettifica
  // names whoever the app believed was holding her, so that the correction
  // turns up in that Cliente's own history, which is where the mill would go
  // looking for why a Cesta stopped being counted against them.
  clienteId: v.optional(v.id("clienti")),
  operatoreId: v.id("operatori"),
  // The Campagna this Movimento belongs to: the one open when it happened, or,
  // when none was, the one the Operatore named on this device (#19). Absent on
  // the Movimenti recorded before the app knew about Campagne, and on any
  // recorded while the mill has none at all — the counter is never blocked by
  // the calendar (ADR-0005), and no row is rewritten afterwards to say
  // otherwise (ADR-0004).
  campagnaId: v.optional(v.id("campagne")),
  // The action this Movimento was part of, so that the Registro reads a Ritiro
  // of six Ceste as the one thing a person did (ADR-0006).
  registroId: v.id("registro"),
};

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

  // The two links an Admin emails: the invitation that opens an account, and
  // the reset that puts a new password on one (ADR-0008). Both are one act in
  // two costumes — somebody chooses a password from a link they were sent —
  // so both are one table, and the rule that a link is good once and not for
  // long is written once.
  //
  // Nobody at this mill ever types a password somebody else chose: the sign-up
  // route is off, there is no self-service reset, and this is the only way an
  // account is opened or its password changed (#26).
  //
  // The links are the app's own rather than Better Auth's, because Better
  // Auth's reset arrives with the endpoint that lets anybody ask for one, and
  // the mill decided against that endpoint before it decided anything else
  // about resets (ADR-0008). Leaving it unconfigured is what closes it.
  accessLinks: defineTable({
    // The secret the emailed URL carries, and the whole of what stands between
    // that URL and the account it opens.
    token: v.string(),
    // Where the link was sent. On an invitation this is the address the
    // account will answer to; on a reset, the one it already answers to.
    email: v.string(),
    expiresAt: v.number(),
    // When the link was used, and nothing while it still can be: an invitation
    // already accepted opens nothing, and neither does a reset already spent.
    usedAt: v.union(v.null(), v.number()),
    // What the link is for, which is also what using it does: an invitation
    // makes an Operatore out of somebody the mill has none of yet, and a reset
    // puts a new password on the one named here.
    purpose: v.union(
      v.object({
        kind: v.literal("invitation"),
        name: v.string(),
        role,
      }),
      v.object({
        kind: v.literal("reset"),
        operatoreId: v.id("operatori"),
      }),
    ),
    // The Admin who sent it. Only an Admin ever does (CONTEXT.md).
    sentBy: v.id("operatori"),
    // What became of the email carrying it. A Resend failure is meant to reach
    // the Admin as an unsent invitation and never the counter (ADR-0008), and
    // this is what it reaches them as.
    delivery: emailDelivery,
  })
    // The link somebody has just followed, found from the token in the URL.
    .index("by_token", ["token"])
    // The invitations still outstanding, which the staff screen lists under
    // the Operatori who have already accepted theirs.
    .index("by_usedAt", ["usedAt"]),

  // The fleet. A Cesta's numero, portata, forma and codice are settled at
  // Censimento and never change afterwards, because the Etichetta is printed
  // (ADR-0007): no mutation edits them, and none deletes a Cesta (ADR-0004).
  ceste: defineTable({
    numero: v.number(),
    portata,
    forma,
    codice: v.string(),
    state,
    // The Cliente the Cesta is with: the one she went out to while she is
    // Fuori, and, once she is back in Attesa molitura, the one whose name the
    // paper tape in the yard carries — which is the Cliente who actually
    // brought her in, whatever the app believed beforehand (#17). Held here
    // beside the state rather than replayed from the Movimenti, for the same
    // reason the state is (ADR-0005): "who has this Cesta" is where she is.
    clienteId: v.optional(v.id("clienti")),
    active: v.boolean(),
  })
    // Also the sequence: the highest numero handed out so far is the first row
    // of this index read backwards.
    .index("by_numero", ["numero"])
    // The Cesta a camera has just read: the QR on her Etichetta carries her
    // Codice and nothing else (ADR-0007), so this is what a scan is looked up
    // by. No two Ceste ever share one — the Codice is generated once from a
    // numero nothing reuses.
    .index("by_codice", ["codice"])
    .index("by_state", ["state"])
    // Which Ceste a Cliente is holding: the Lista di recupero's own read (#22),
    // and the warning before an Admin deactivates somebody.
    .index("by_cliente_and_state", ["clienteId", "state"]),

  // The mill's registry: whoever takes Ceste away and brings them back. Never
  // deleted, only deactivated (ADR-0004), so that a Cliente still holding Ceste
  // stays on the Lista di recupero after the mill has written them off.
  clienti: defineTable({
    name: v.string(),
    // The further names the counter knows them by, Soprannomi on screen. Shown
    // after the name wherever Clienti are listed, and matched by search, so
    // that two Giuseppe Amato are told apart by the person typing.
    alias: v.array(v.string()),
    // Nullable rather than absent: the mill either knows a Cliente's telephone
    // or it does not, and the Lista di recupero has to say which (#22).
    phone: v.union(v.null(), v.string()),
    // The Gestionale record this Cliente answers to, once the one-way mirror
    // exists (ADR-0003). Nothing populates it yet, and nothing ever writes
    // back to the Gestionale.
    gestionaleId: v.union(v.null(), v.string()),
    active: v.boolean(),
  })
    // The registry is read whole and sorted by name: this is that order.
    .index("by_name", ["name"]),

  // What the whole mill has settled on, as one row and no more: the Etichetta
  // the print shop prints, and the Soglia di ritardo beside it. An empty table
  // means nobody has changed anything yet, and every setting reads as the
  // app's own.
  settings: defineTable(settingsFields),

  // The mill's seasons. At most one is open at any moment — enforced in the
  // mutation that opens one and not only in the screen that offers it — and
  // every Movimento belongs to one: the open Campagna, or the one the
  // Operatore named when none was (CONTEXT.md).
  campagne: defineTable({
    name: v.string(),
    // When the season was opened, and when it was closed, or nothing while it
    // is still open. Reopening clears the close rather than moving the
    // opening: the season started when it started, and the Registro is what
    // says it was closed by mistake and put back (ADR-0004).
    openedAt: v.number(),
    closedAt: v.union(v.null(), v.number()),
  })
    // The open Campagna as a single row: the read every Movimento makes.
    .index("by_closedAt", ["closedAt"]),

  // One row per Cesta per occasion: six Ceste leaving together are six
  // Movimenti (CONTEXT.md). Never edited and never deleted (ADR-0004).
  movimenti: defineTable(
    v.union(
      v.object({ ...movimentoFields, kind: plainMovimentoKind }),
      v.object({
        ...movimentoFields,
        kind: v.literal("rettifica"),
        // Required here and nowhere else: a Rettifica without a reason is a
        // delete wearing a different hat, and the table is what refuses one
        // (ADR-0004). No mutation is trusted to remember.
        rettifica: v.object(rettificaFields),
      }),
    ),
  )
    .index("by_cliente", ["clienteId"])
    // One Cesta's own history, newest last.
    .index("by_cesta", ["cestaId"])
    // The newest Movimento of one kind against her, read as a single row: the
    // Ritiro that took her out, which is what "Fuori since" means on the
    // Rientro and on the Lista di recupero (#22), and the Rientro that brought
    // her back, which dates a Cliente's stack on the Svuotamento screen (#18).
    .index("by_cesta_and_kind", ["cestaId", "kind"]),

  // One row per action a person took, however many Ceste it moved (ADR-0006).
  // Written inside the mutation making the change, never edited and never
  // deleted (ADR-0004): no mutation to do either exists, here or anywhere.
  registro: defineTable({
    operatoreId: v.id("operatori"),
    // The Cliente the action concerns, where it concerns one — a Censimento
    // and an Etichetta setting concern nobody. Held on the row beside the
    // Operatore, as ADR-0006 has it, so that the Registro of one Cliente is a
    // range read rather than a scan of every action ever taken.
    clienteId: v.optional(v.id("clienti")),
    // The Campagna the action belongs to, beside them for the same reason
    // (ADR-0006), and absent on the same terms as on a Movimento: the rows
    // written before this table knew about Campagne carry none.
    campagnaId: v.optional(v.id("campagne")),
    // Whether this action left a Rettifica behind it — the app wrong about a
    // Cesta at the counter, or an Admin saying what became of one. A Ritiro of
    // six Ceste with two discrepanze is still one row, and this is the flag
    // that lets the Registro pick those rows out (#21, #27).
    //
    // Written here rather than counted at read time, because the alternative
    // is a second read per row on the query the Registro screen makes all day.
    // Absent on the rows written before the flag existed, which is what the
    // rows a deployment already holds are: none of them is rewritten to say
    // otherwise (ADR-0004).
    producedRettifica: v.optional(v.boolean()),
    // The row this one corrects: the action a Rettifica of *errore* says was
    // registered wrongly, and nothing on every other row (#28).
    //
    // Here beside the Operatore and the Cliente rather than inside the action,
    // for the reason they are: it is read for through an index. The correction
    // is written days after the action it corrects and the corrected row is
    // never edited to point back (ADR-0004), so the Registro finds the pair
    // from this end and reads the other one off this index.
    corrects: v.optional(v.id("registro")),
    action,
  })
    // The two filters the Registro offers besides the day, which the built-in
    // by_creation_time index answers. Every index carries _creationTime as its
    // last field, so a Cliente's day and an Operatore's day are range reads
    // too.
    .index("by_cliente", ["clienteId"])
    .index("by_operatore", ["operatoreId"])
    // The Rettifiche that correct one action, so that a row can say it was
    // corrected without ever having been rewritten to say so.
    .index("by_corrects", ["corrects"]),
});
