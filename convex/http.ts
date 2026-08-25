import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { questionnairePage } from "./questionnairePage";

const http = httpRouter();

// The /questionario paths stay Italian: the mill has this URL and it must not break.
http.route({
  path: "/questionario",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const latest = await ctx.runQuery(internal.questionnaire.latest, {});
    const state = latest
      ? { savedAt: latest.savedAt, answers: latest.answers }
      : {};
    const html = questionnairePage.replace(
      "__STATE__",
      JSON.stringify(state).replace(/</g, "\\u003c"),
    );
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }),
});

http.route({
  path: "/questionario/invia",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }
    const { savedAt, answers } = (body ?? {}) as {
      savedAt?: unknown;
      answers?: unknown;
    };
    if (
      typeof savedAt !== "string" ||
      savedAt.length > 100 ||
      typeof answers !== "object" ||
      answers === null ||
      JSON.stringify(answers).length > 50_000
    ) {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }
    await ctx.runMutation(internal.questionnaire.save, { savedAt, answers });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
