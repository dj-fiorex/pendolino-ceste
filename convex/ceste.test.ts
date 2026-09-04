/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses: no table is read or written directly, and nothing is mocked
// (spec #1).
const modules = import.meta.glob("./**/*.ts");

const startApp = () => {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
};

/** The mill's Admin, signed in on a device. */
const admin = async (t: TestConvex<typeof schema>) => {
  const { authUserId } = await t.action(internal.seed.createFirstAdmin, {
    name: "Gabriele",
    email: "gabriele@frantoio.example",
    password: "olive-di-ottobre",
  });
  return t.withIdentity({ subject: authUserId });
};

/**
 * A second Operatore, counter staff rather than Admin. Nobody signs themselves
 * up, so staff arrive by seed script or by an Admin's invitation (#26): until
 * that invitation exists, this is the same internal function it will call.
 */
const operatore = async (t: TestConvex<typeof schema>) => {
  await t.mutation(internal.operatori.create, {
    authUserId: "auth|marco",
    name: "Marco",
    email: "marco@frantoio.example",
    role: "operatore",
  });
  return t.withIdentity({ subject: "auth|marco" });
};

describe("Censimento", () => {
  test("three Ceste entered together get the first three numeri", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 3,
    });

    expect(await gabriele.query(api.ceste.list, {})).toEqual([
      {
        numero: 1,
        codice: "400-R-001",
        portata: 400,
        forma: "rettangolare",
        state: "disponibile",
      },
      {
        numero: 2,
        codice: "400-R-002",
        portata: 400,
        forma: "rettangolare",
        state: "disponibile",
      },
      {
        numero: 3,
        codice: "400-R-003",
        portata: 400,
        forma: "rettangolare",
        state: "disponibile",
      },
    ]);
  });

  test("the numero runs on across Portate and Forme, so the first 250 kg Cesta is 250-Q-171", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 170,
    });
    const { fromNumero, toNumero } = await gabriele.mutation(
      api.ceste.censimento,
      { portata: 250, forma: "quadrata", count: 25 },
    );

    expect({ fromNumero, toNumero }).toEqual({
      fromNumero: 171,
      toNumero: 195,
    });
    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste).toHaveLength(195);
    expect(ceste[16]).toEqual({
      numero: 17,
      codice: "400-R-017",
      portata: 400,
      forma: "rettangolare",
      state: "disponibile",
    });
    expect(ceste[170]).toEqual({
      numero: 171,
      codice: "250-Q-171",
      portata: 250,
      forma: "quadrata",
      state: "disponibile",
    });
    // No two Ceste in the yard answer to the same Codice.
    expect(new Set(ceste.map((cesta) => cesta.codice)).size).toBe(195);
  });

  test("a Cesta bought part-way through a Campagna is a Censimento of one, and takes the following numero", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 3,
    });

    const range = await gabriele.mutation(api.ceste.censimento, {
      portata: 250,
      forma: "quadrata",
      count: 1,
    });

    expect(range).toEqual({ fromNumero: 4, toNumero: 4 });
    expect((await gabriele.query(api.ceste.list, {})).at(-1)).toEqual({
      numero: 4,
      codice: "250-Q-004",
      portata: 250,
      forma: "quadrata",
      state: "disponibile",
    });
  });

  test("a Censimento writes one Registro row, however many Ceste it covers", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 100,
    });

    expect(await gabriele.query(api.registro.list, {})).toEqual([
      {
        _id: expect.any(String),
        at: expect.any(Number),
        operatore: "Gabriele",
        // A Censimento concerns no Cliente.
        cliente: null,
        campagna: null,
        producedRettifica: false,
        action: {
          kind: "censimento",
          portata: 400,
          forma: "rettangolare",
          count: 100,
          fromNumero: 1,
          toNumero: 100,
        },
      },
    ]);
  });

  test("only an Admin can enter Ceste into the fleet", async () => {
    const t = startApp();
    await admin(t);
    const marco = await operatore(t);

    await expect(
      marco.mutation(api.ceste.censimento, {
        portata: 400,
        forma: "rettangolare",
        count: 1,
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.ceste.censimento, {
        portata: 400,
        forma: "rettangolare",
        count: 1,
      }),
    ).rejects.toThrow();
    expect(await marco.query(api.ceste.list, {})).toEqual([]);
  });

  test("a Censimento of no Ceste, or of a fraction of one, is refused", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    for (const count of [0, -3, 2.5, 501]) {
      await expect(
        gabriele.mutation(api.ceste.censimento, {
          portata: 400,
          forma: "rettangolare",
          count,
        }),
      ).rejects.toThrow();
    }
    expect(await gabriele.query(api.ceste.list, {})).toEqual([]);
  });
});

describe("the fleet screen", () => {
  test("counts the Disponibili by Portata, and the Forma does not split them", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 5,
    });
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "quadrata",
      count: 3,
    });
    await gabriele.mutation(api.ceste.censimento, {
      portata: 250,
      forma: "quadrata",
      count: 2,
    });

    expect(await gabriele.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 8 },
      { portata: 250, count: 2 },
    ]);
  });

  test("both Portate are counted even when the mill has none of one", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 2,
    });

    expect(await gabriele.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 2 },
      { portata: 250, count: 0 },
    ]);
  });

  test("every Operatore sees the fleet and its counts; nobody signed in sees neither", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 2,
    });
    const marco = await operatore(t);

    expect(await marco.query(api.ceste.list, {})).toHaveLength(2);
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 2 },
      { portata: 250, count: 0 },
    ]);
    await expect(t.query(api.ceste.list, {})).rejects.toThrow();
    await expect(t.query(api.ceste.disponibiliByPortata, {})).rejects.toThrow();
  });

  test("the Registro is not for the counter to read", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 2,
    });
    const marco = await operatore(t);

    await expect(marco.query(api.registro.list, {})).rejects.toThrow();
  });
});

// "A Dismessa Cesta keeps her numero and a later Censimento takes the
// following one" is the sequence's other half, and it is #20's test to write:
// the Rettifica that retires a Cesta arrives there, and nothing in this ticket
// can produce a Dismessa Cesta through the one seam this suite uses. The
// numero comes from the highest ever handed out — never from a count of what
// exists — precisely so that it holds when that day comes.
