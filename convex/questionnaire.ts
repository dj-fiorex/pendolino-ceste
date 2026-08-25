import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => {
    const righe = await ctx.db
      .query("questionarioRisposte")
      .order("desc")
      .take(1);
    return righe[0] ?? null;
  },
});

export const save = internalMutation({
  args: { savedAt: v.string(), answers: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("questionarioRisposte", args);
  },
});
