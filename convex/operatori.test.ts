/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses.
const modules = import.meta.glob("./**/*.ts");

const startApp = () => {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
};

describe("the Operatore signed in on a device", () => {
  test("nobody is signed in before anybody signs in", async () => {
    const t = startApp();

    expect(await t.query(api.operatori.current, {})).toBeNull();
  });

  test("the seeded first Admin is known by name and by role", async () => {
    const t = startApp();
    const { authUserId } = await t.action(internal.seed.createFirstAdmin, {
      name: "Gabriele",
      email: "gabriele@frantoio.example",
      password: "olive-di-ottobre",
    });

    const operatore = await t
      .withIdentity({ subject: authUserId })
      .query(api.operatori.current, {});

    expect(operatore).toEqual({
      name: "Gabriele",
      email: "gabriele@frantoio.example",
      role: "admin",
    });
  });

  test("the mill gets only one first Admin", async () => {
    const t = startApp();
    const firstAdmin = {
      name: "Gabriele",
      email: "gabriele@frantoio.example",
      password: "olive-di-ottobre",
    };
    await t.action(internal.seed.createFirstAdmin, firstAdmin);

    await expect(
      t.action(internal.seed.createFirstAdmin, {
        ...firstAdmin,
        email: "secondo@frantoio.example",
      }),
    ).rejects.toThrow();
  });
});
