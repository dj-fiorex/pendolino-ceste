import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** An Operatore is either plain counter staff or an Admin. */
export const ruolo = v.union(v.literal("operatore"), v.literal("admin"));

export default defineSchema({
  // The app's own staff record. Better Auth owns the credentials; the ruolo and
  // the active flag are the app's own concern and live here (ADR-0008).
  operatori: defineTable({
    // The Better Auth user this record belongs to, as it appears in the
    // identity subject of a signed-in request.
    authUserId: v.string(),
    nome: v.string(),
    email: v.string(),
    ruolo,
    attivo: v.boolean(),
  }).index("by_authUserId", ["authUserId"]),

  // Requirements questionnaire submissions: one row per submission, the latest one wins.
  // Name kept in Italian to avoid migrating the mill's answers mid-questionnaire.
  questionarioRisposte: defineTable({
    savedAt: v.string(),
    answers: v.any(),
  }),
});
