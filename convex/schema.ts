import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Requirements questionnaire submissions: one row per submission, the latest one wins.
  // Name kept in Italian to avoid migrating the mill's answers mid-questionnaire.
  questionarioRisposte: defineTable({
    savedAt: v.string(),
    answers: v.any(),
  }),
});
