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

/** A second Operatore, counter staff rather than Admin. */
const operatore = async (t: TestConvex<typeof schema>) => {
  await t.mutation(internal.operatori.create, {
    authUserId: "auth|marco",
    name: "Marco",
    email: "marco@frantoio.example",
    role: "operatore",
  });
  return t.withIdentity({ subject: "auth|marco" });
};

describe("the Cliente at the counter", () => {
  test("is created with nothing but a name, and found by it", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    expect(await marco.query(api.clienti.search, { term: "amato" })).toEqual([
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
      },
    ]);
  });
});

describe("two Clienti with the same name", () => {
  test("the second is refused, and the first is the one to pick", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    await expect(
      marco.mutation(api.clienti.create, { name: "giuseppe  amato" }),
    ).rejects.toThrow();

    expect(await marco.query(api.clienti.search, { term: "amato" })).toEqual([
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
      },
    ]);
  });

  test("an Alias tells them apart, and the counter sees both", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
      phone: "333 111 2222",
    });

    expect(await marco.query(api.clienti.search, { term: "amato" })).toEqual([
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
      },
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: ["Turi"],
        phone: "333 111 2222",
      },
    ]);
  });

  test("never share an Alias either, or nothing tells them apart", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    await expect(
      marco.mutation(api.clienti.create, {
        name: "Giuseppe Amato",
        alias: ["turi", "u' pilota"],
      }),
    ).rejects.toThrow();

    expect(
      await marco.query(api.clienti.search, { term: "amato" }),
    ).toHaveLength(1);
  });

  test("a deactivated namesake still needs telling apart, though nobody can pick them", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await gabriele.mutation(api.clienti.deactivate, {
      clienteId,
      confirmed: false,
    });

    // They are gone from the search, and still on the Lista di recupero with
    // whatever Ceste they hold: a second Giuseppe Amato with nothing to tell
    // them apart is the confusion the rule exists to prevent (ADR-0004).
    expect(await gabriele.query(api.clienti.search, { term: "amato" })).toEqual(
      [],
    );
    await expect(
      gabriele.mutation(api.clienti.create, { name: "Giuseppe Amato" }),
    ).rejects.toThrow();
    expect(
      await gabriele.query(api.clienti.namesakes, { name: "giuseppe amato" }),
    ).toEqual([
      {
        _id: clienteId,
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
        active: false,
      },
    ]);

    await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["u' pilota"],
    });

    expect(
      await gabriele.query(api.clienti.search, { term: "amato" }),
    ).toHaveLength(1);
  });

  test("a different name with the same Alias is two people the counter knows", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
      alias: ["Turi"],
    });

    expect(
      await marco.query(api.clienti.search, { term: "turi" }),
    ).toHaveLength(2);
  });
});

describe("the Registro", () => {
  test("carries the Cliente that was created, under the Operatore who did it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);

    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    expect(await gabriele.query(api.registro.list, {})).toEqual([
      {
        _id: expect.any(String),
        at: expect.any(Number),
        operatore: "Marco",
        cliente: { name: "Giuseppe Amato", alias: [] },
        action: {
          kind: "cliente_creato",
          name: "Giuseppe Amato",
        },
      },
    ]);
  });
});

describe("correcting a Cliente", () => {
  test("any Operatore fixes the name, the Alias and the telephone", async () => {
    const t = startApp();
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giusepe Amato",
    });

    await marco.mutation(api.clienti.update, {
      clienteId,
      name: "Giuseppe Amato",
      alias: ["Turi", "u' pilota"],
      phone: "333 111 2222",
    });

    expect(await marco.query(api.clienti.search, { term: "pilota" })).toEqual([
      {
        _id: clienteId,
        name: "Giuseppe Amato",
        alias: ["Turi", "u' pilota"],
        phone: "333 111 2222",
      },
    ]);
  });

  test("the correction is one Registro row, naming only what changed", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "333 111 2222",
    });

    await marco.mutation(api.clienti.update, {
      clienteId,
      name: "Giuseppe Amato",
      alias: [],
      phone: "333 999 8888",
    });

    const registro = await gabriele.query(api.registro.list, {});
    expect(registro[0]).toEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Marco",
      cliente: { name: "Giuseppe Amato", alias: [] },
      action: {
        kind: "cliente_modificato",
        changes: [
          { field: "phone", before: "333 111 2222", after: "333 999 8888" },
        ],
      },
    });
  });

  test("saving a Cliente unchanged records nothing", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    await gabriele.mutation(api.clienti.update, {
      clienteId,
      name: "  Giuseppe   Amato ",
      alias: ["Turi"],
      phone: "",
    });

    expect(await gabriele.query(api.registro.list, {})).toHaveLength(1);
  });

  test("a rename onto a namesake is refused, and the Cliente stays as it was", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });

    await expect(
      marco.mutation(api.clienti.update, {
        clienteId,
        name: "Giuseppe Amato",
        alias: [],
        phone: "",
      }),
    ).rejects.toThrow();

    expect(await marco.query(api.clienti.search, { term: "russo" })).toEqual([
      {
        _id: clienteId,
        name: "Salvatore Russo",
        alias: [],
        phone: null,
      },
    ]);
  });
});

describe("deactivating a Cliente", () => {
  test("takes them out of the search, and is an Admin's to do", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await expect(
      marco.mutation(api.clienti.deactivate, { clienteId, confirmed: false }),
    ).rejects.toThrow();
    await gabriele.mutation(api.clienti.deactivate, {
      clienteId,
      confirmed: false,
    });

    expect(await marco.query(api.clienti.search, { term: "amato" })).toEqual(
      [],
    );
    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      name: "Giuseppe Amato",
      active: false,
    });
  });

  test("waits for a confirmation while they still hold Ceste, and keeps them", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 3,
    });
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cesta = await gabriele.query(api.ceste.byNumero, { numero: "2" });
    await gabriele.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: cesta === null ? [] : [cesta._id],
    });

    await expect(
      gabriele.mutation(api.clienti.deactivate, {
        clienteId,
        confirmed: false,
      }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.clienti.get, { clienteId })).toMatchObject({
      active: true,
    });

    await gabriele.mutation(api.clienti.deactivate, {
      clienteId,
      confirmed: true,
    });

    // Nobody leaves the Lista di recupero for being deactivated: only a
    // Rientro or a Rettifica takes a Cesta off it (CONTEXT.md, #22).
    expect(await gabriele.query(api.clienti.get, { clienteId })).toMatchObject({
      active: false,
      cesteFuori: [expect.objectContaining({ codice: "400-R-002" })],
    });
    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Gabriele",
      cliente: { name: "Giuseppe Amato", alias: [] },
      action: {
        kind: "cliente_disattivato",
        name: "Giuseppe Amato",
        numeriFuori: [2],
      },
    });
  });
});
