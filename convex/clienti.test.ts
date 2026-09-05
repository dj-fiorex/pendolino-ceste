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
        smsOptOut: false,
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
        smsOptOut: false,
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
        smsOptOut: false,
      },
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: ["Turi"],
        phone: "+393331112222",
        smsOptOut: false,
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
        smsOptOut: false,
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
        campagna: null,
        producedRettifica: false,
        corrects: null,
        correctedBy: [],
        media: { signature: null, photo: null },
        sms: null,
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
      smsOptOut: false,
    });

    expect(await marco.query(api.clienti.search, { term: "pilota" })).toEqual([
      {
        _id: clienteId,
        name: "Giuseppe Amato",
        alias: ["Turi", "u' pilota"],
        phone: "+393331112222",
        smsOptOut: false,
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
      smsOptOut: false,
    });

    const registro = await gabriele.query(api.registro.list, {});
    expect(registro[0]).toEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Marco",
      cliente: { name: "Giuseppe Amato", alias: [] },
      campagna: null,
      producedRettifica: false,
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
      action: {
        kind: "cliente_modificato",
        changes: [
          {
            field: "phone",
            before: "+393331112222",
            after: "+393339998888",
          },
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
      smsOptOut: false,
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
        smsOptOut: false,
      }),
    ).rejects.toThrow();

    expect(await marco.query(api.clienti.search, { term: "russo" })).toEqual([
      {
        _id: clienteId,
        name: "Salvatore Russo",
        alias: [],
        phone: null,
        smsOptOut: false,
      },
    ]);
  });
});

describe("the telephone", () => {
  test("is kept as a carrier takes it, however the counter wrote it", async () => {
    const t = startApp();
    const marco = await operatore(t);

    for (const [typed, kept] of [
      ["347 1234567", "+393471234567"],
      ["3471234567", "+393471234567"],
      ["+39 347 123 4567", "+393471234567"],
      ["0039 347 1234567", "+393471234567"],
      // A landline: a good number to call, and one no SMS will reach.
      ["0931 000000", "+390931000000"],
      // Whoever winters abroad and still brings olives in October.
      ["+49 151 12345678", "+4915112345678"],
    ]) {
      const clienteId = await marco.mutation(api.clienti.create, {
        name: `Cliente ${typed}`,
        phone: typed,
      });
      const cliente = await marco.query(api.clienti.get, { clienteId });
      expect(cliente?.phone).toBe(kept);
    }
  });

  test("a number nobody could call is refused, at the moment it can be asked for", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await expect(
      marco.mutation(api.clienti.create, {
        name: "Giuseppe Amato",
        phone: "chiedere al figlio",
      }),
    ).rejects.toThrow();
    await expect(
      marco.mutation(api.clienti.create, {
        name: "Giuseppe Amato",
        phone: "347 12",
      }),
    ).rejects.toThrow();

    expect(await marco.query(api.clienti.search, { term: "amato" })).toEqual(
      [],
    );
  });

  test("having none is not a mistake: the counter is never blocked", async () => {
    const t = startApp();
    const marco = await operatore(t);

    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "   ",
    });

    expect(
      (await marco.query(api.clienti.get, { clienteId }))?.phone,
    ).toBeNull();
  });

  test("a correction is refused the same way, and changes nothing", async () => {
    const t = startApp();
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await expect(
      marco.mutation(api.clienti.update, {
        clienteId,
        name: "Giuseppe Amato",
        alias: [],
        phone: "347",
        smsOptOut: false,
      }),
    ).rejects.toThrow();

    expect((await marco.query(api.clienti.get, { clienteId }))?.phone).toBe(
      "+393471234567",
    );
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
      campagna: null,
      producedRettifica: false,
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
      action: {
        kind: "cliente_disattivato",
        name: "Giuseppe Amato",
        numeriFuori: [2],
      },
    });
  });
});
