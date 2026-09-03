/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

type Device = Awaited<ReturnType<typeof operatore>>;

/** A fleet to hand out: ten Ceste of 400 kg, numeri 1 to 10. */
const aFleetOfTen = async (gabriele: Device) => {
  await gabriele.mutation(api.ceste.censimento, {
    portata: 400,
    forma: "rettangolare",
    count: 10,
  });
};

/** The Cesta an Operatore has just typed the numero of, as the screen adds it. */
const typeNumero = async (device: Device, numero: string) => {
  const cesta = await device.query(api.ceste.byNumero, { numero });
  if (cesta === null) {
    throw new Error(`No Cesta answers to the numero ${numero}.`);
  }
  return cesta._id;
};

describe("a Ritiro at the counter", () => {
  test("six Ceste leave as six Movimenti under one Registro row", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    const cesteIds = [];
    for (const numero of ["1", "002", "3", "4", "5", "006"]) {
      cesteIds.push(await typeNumero(marco, numero));
    }
    await marco.mutation(api.movimenti.ritiro, { clienteId, cesteIds });

    const movimenti = await marco.query(api.movimenti.byCliente, { clienteId });
    expect(movimenti).toHaveLength(6);
    // Newest first, and the six of one Ritiro share an instant: what the
    // Cliente took is the assertion, not the order they come back in.
    expect(movimenti.map((movimento) => movimento.codice).sort()).toEqual([
      "400-R-001",
      "400-R-002",
      "400-R-003",
      "400-R-004",
      "400-R-005",
      "400-R-006",
    ]);
    expect(movimenti.every((movimento) => movimento.kind === "ritiro")).toBe(
      true,
    );
    expect(
      movimenti.every((movimento) => movimento.operatore === "Marco"),
    ).toBe(true);
    // One action, however many Ceste it moved: every Movimento points at the
    // one Registro row that produced it (ADR-0006).
    expect(
      new Set(movimenti.map((movimento) => movimento.registroId)).size,
    ).toBe(1);
    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Marco",
      cliente: { name: "Giuseppe Amato", alias: [] },
      action: {
        kind: "ritiro",
        numeri: [1, 2, 3, 4, 5, 6],
      },
    });
  });

  test("those Ceste are Fuori, and the Disponibili have fallen by six", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    const cesteIds = [];
    for (const numero of ["1", "2", "3", "4", "5", "6"]) {
      cesteIds.push(await typeNumero(marco, numero));
    }
    await marco.mutation(api.movimenti.ritiro, { clienteId, cesteIds });

    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 4 },
      { portata: 250, count: 0 },
    ]);
    const ceste = await marco.query(api.ceste.list, {});
    expect(
      ceste.filter((cesta) => cesta.state === "fuori").map((c) => c.numero),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await marco.query(api.clienti.get, { clienteId })).toEqual({
      _id: clienteId,
      name: "Giuseppe Amato",
      alias: [],
      phone: null,
      active: true,
      cesteFuori: [1, 2, 3, 4, 5, 6].map((numero) => ({
        _id: expect.any(String),
        numero,
        codice: `400-R-00${numero}`,
        portata: 400,
        forma: "rettangolare",
        // When the Ritiro that took her out happened: what the counter reads
        // as "Fuori dal 25 ott · 11 giorni".
        since: expect.any(Number),
      })),
    });
  });

  test("a numero that answers to no Cesta is reported, and nothing is added", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);

    expect(
      await gabriele.query(api.ceste.byNumero, { numero: "999" }),
    ).toBeNull();
    expect(await gabriele.query(api.ceste.byNumero, { numero: "" })).toBeNull();
    expect(
      await gabriele.query(api.ceste.byNumero, { numero: "sette" }),
    ).toBeNull();
    expect(
      await gabriele.query(api.ceste.byNumero, { numero: " 007 " }),
    ).toEqual({
      _id: expect.any(String),
      numero: 7,
      codice: "400-R-007",
      portata: 400,
      cliente: null,
    });
  });

  test("the same Cesta added twice is one Cesta, and a Ritiro of none is refused", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cestaId = await typeNumero(gabriele, "3");

    await expect(
      gabriele.mutation(api.movimenti.ritiro, { clienteId, cesteIds: [] }),
    ).rejects.toThrow();
    await gabriele.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [cestaId, cestaId],
    });

    expect(
      await gabriele.query(api.movimenti.byCliente, { clienteId }),
    ).toHaveLength(1);
  });

  test("a Cesta the app believed Fuori with somebody else goes out anyway", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const salvatore = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    const cestaId = await typeNumero(marco, "3");
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: giuseppe,
      cesteIds: [cestaId],
    });

    // The Cesta is in the yard and the Cliente is loading it: the app records
    // what happens rather than authorising it (ADR-0005). Reporting the
    // mismatch is #21's, and nothing may block here in the meantime.
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });

    expect(
      await marco.query(api.clienti.get, { clienteId: giuseppe }),
    ).toMatchObject({ cesteFuori: [] });
    expect(
      await marco.query(api.clienti.get, { clienteId: salvatore }),
    ).toMatchObject({ cesteFuori: [expect.objectContaining({ numero: 3 })] });
    expect(
      await marco.query(api.movimenti.byCliente, { clienteId: giuseppe }),
    ).toHaveLength(1);
  });

  test("nobody signed in records a Ritiro, or reads one", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cestaId = await typeNumero(gabriele, "1");

    await expect(
      t.mutation(api.movimenti.ritiro, { clienteId, cesteIds: [cestaId] }),
    ).rejects.toThrow();
    await expect(
      t.query(api.ceste.byNumero, { numero: "1" }),
    ).rejects.toThrow();
    await expect(
      t.query(api.movimenti.byCliente, { clienteId }),
    ).rejects.toThrow();
  });
});

describe("a Rientro at the counter", () => {
  /** A Ritiro of the numeri given, so that there is a load to bring back. */
  const takeAway = async (
    device: Device,
    clienteId: Id<"clienti">,
    numeri: string[],
  ) => {
    const cesteIds = [];
    for (const numero of numeri) {
      cesteIds.push(await typeNumero(device, numero));
    }
    await device.mutation(api.movimenti.ritiro, { clienteId, cesteIds });
    return cesteIds;
  };

  test("the numero of one Cesta of the load says whose the load is", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
      phone: "349 1234567",
    });
    await takeAway(marco, clienteId, ["1", "2", "3"]);

    // Nobody is searched for: the Operatore reads a numero off the trailer and
    // the app names the Cliente.
    expect(await marco.query(api.ceste.byNumero, { numero: "2" })).toEqual({
      _id: expect.any(String),
      numero: 2,
      codice: "400-R-002",
      portata: 400,
      cliente: {
        _id: clienteId,
        name: "Giuseppe Amato",
        alias: ["Turi"],
        phone: "349 1234567",
      },
    });
    // A Cesta the app believes at the mill names nobody, and the screen falls
    // back to the Cliente search (#16).
    expect(
      await marco.query(api.ceste.byNumero, { numero: "9" }),
    ).toMatchObject({ cliente: null });
  });

  test("the whole load comes back as Movimenti under one Registro row", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cesteIds = await takeAway(marco, clienteId, ["1", "2", "3", "4"]);

    await marco.mutation(api.movimenti.rientro, { clienteId, cesteIds });

    const rientri = (
      await marco.query(api.movimenti.byCliente, { clienteId })
    ).filter((movimento) => movimento.kind === "rientro");
    expect(rientri.map((movimento) => movimento.codice).sort()).toEqual([
      "400-R-001",
      "400-R-002",
      "400-R-003",
      "400-R-004",
    ]);
    expect(new Set(rientri.map((movimento) => movimento.registroId)).size).toBe(
      1,
    );
    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Marco",
      cliente: { name: "Giuseppe Amato", alias: [] },
      action: { kind: "rientro", numeri: [1, 2, 3, 4] },
    });
    // Back at the mill, still full: not yet Disponibile, and no longer Fuori.
    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      cesteFuori: [],
    });
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 6 },
      { portata: 250, count: 0 },
    ]);
  });

  test("four of six come back, and the other two stay Fuori with the same Cliente", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cesteIds = await takeAway(marco, clienteId, [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);

    await marco.mutation(api.movimenti.rientro, {
      clienteId,
      cesteIds: cesteIds.slice(0, 4),
    });

    // What was not brought back is still counted against him: there is no code
    // about partial returns anywhere, only Ceste that were added and Ceste that
    // were not.
    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      cesteFuori: [
        expect.objectContaining({ numero: 5 }),
        expect.objectContaining({ numero: 6 }),
      ],
    });
    const ceste = await marco.query(api.ceste.list, {});
    expect(
      ceste
        .filter((cesta) => cesta.state === "attesa_molitura")
        .map((cesta) => cesta.numero),
    ).toEqual([1, 2, 3, 4]);
  });

  test("a Cesta the app believed another Cliente's comes back under the one present", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const salvatore = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    const [cestaId] = await takeAway(marco, giuseppe, ["3"]);

    // Salvatore is the one at the counter, so his is the name the paper tape
    // will carry (ADR-0005). Reporting the mismatch is #21's.
    await marco.mutation(api.movimenti.rientro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });

    expect(
      await marco.query(api.clienti.get, { clienteId: giuseppe }),
    ).toMatchObject({ cesteFuori: [] });
    expect(await marco.query(api.ceste.attesaMolitura, {})).toEqual([
      {
        _id: cestaId,
        numero: 3,
        codice: "400-R-003",
        portata: 400,
        cliente: {
          _id: salvatore,
          name: "Salvatore Russo",
          alias: [],
          phone: null,
        },
      },
    ]);
  });

  test("a Cesta the app believed Disponibile comes back anyway", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cestaId = await typeNumero(marco, "7");

    // No Ritiro ever took her out, and the Rientro goes through regardless: no
    // mutation refuses a Cesta for the state she is in (ADR-0005).
    await marco.mutation(api.movimenti.rientro, {
      clienteId,
      cesteIds: [cestaId],
    });

    expect(
      (await marco.query(api.ceste.attesaMolitura, {})).map(
        (cesta) => cesta.numero,
      ),
    ).toEqual([7]);
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 9 },
      { portata: 250, count: 0 },
    ]);
  });

  test("the yard is read against the tapes, by numero and by name", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const salvatore = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });

    expect(await marco.query(api.ceste.attesaMolitura, {})).toEqual([]);
    const his = await takeAway(marco, giuseppe, ["4", "1"]);
    const hers = await takeAway(marco, salvatore, ["2"]);
    await marco.mutation(api.movimenti.rientro, {
      clienteId: giuseppe,
      cesteIds: his,
    });
    await marco.mutation(api.movimenti.rientro, {
      clienteId: salvatore,
      cesteIds: hers,
    });

    expect(
      (await marco.query(api.ceste.attesaMolitura, {})).map((cesta) => [
        cesta.numero,
        cesta.cliente?.name,
      ]),
    ).toEqual([
      [1, "Giuseppe Amato"],
      [2, "Salvatore Russo"],
      [4, "Giuseppe Amato"],
    ]);
  });

  test("a Cesta Fuori says when the Ritiro that took her out happened", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    // Out, back, and out again: what the counter reads as "Fuori dal 25 ott"
    // is the Ritiro that took her out this time, not the one before it.
    const cesteIds = await takeAway(marco, clienteId, ["1"]);
    await marco.mutation(api.movimenti.rientro, { clienteId, cesteIds });
    await marco.mutation(api.movimenti.ritiro, { clienteId, cesteIds });

    const ritiri = (await marco.query(api.movimenti.byCliente, { clienteId }))
      .filter((movimento) => movimento.kind === "ritiro")
      .map((movimento) => movimento.at)
      .sort((one, other) => one - other);
    expect(ritiri).toHaveLength(2);
    const cliente = await marco.query(api.clienti.get, { clienteId });
    expect(cliente?.cesteFuori).toEqual([
      expect.objectContaining({ numero: 1, since: ritiri[1] }),
    ]);
  });

  test("nobody signed in records a Rientro, or reads the yard", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cestaId = await typeNumero(gabriele, "1");

    await expect(
      t.mutation(api.movimenti.rientro, { clienteId, cesteIds: [cestaId] }),
    ).rejects.toThrow();
    await expect(t.query(api.ceste.attesaMolitura, {})).rejects.toThrow();
  });
});
