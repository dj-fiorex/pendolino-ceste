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

/**
 * A Ritiro and then the Rientro that brings the load back: the Ceste are in
 * the yard, full, with the Cliente's name on their tapes.
 */
const bringBack = async (
  device: Device,
  clienteId: Id<"clienti">,
  numeri: string[],
) => {
  const cesteIds = await takeAway(device, clienteId, numeri);
  await device.mutation(api.movimenti.rientro, { clienteId, cesteIds });
  return cesteIds;
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
      // The mill has no Campagna open here, and the Ritiro goes through all
      // the same: the counter is not blocked by the calendar either (#19).
      campagna: null,
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
      state: "disponibile",
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
      state: "fuori",
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
      campagna: null,
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

describe("a Svuotamento where the Ceste are tipped out", () => {
  /** Where Cesta 1 is, and how many Ceste of 400 kg are Disponibile. */
  const cestaOneAndTheCount = async (device: Device) => {
    const ceste = await device.query(api.ceste.list, {});
    const disponibili = await device.query(api.ceste.disponibiliByPortata, {});
    return {
      state: ceste.find((cesta) => cesta.numero === 1)?.state,
      disponibili: disponibili.find((count) => count.portata === 400)?.count,
    };
  };

  test("one Cesta goes all the way round: Disponibile, Fuori, Attesa molitura, Disponibile", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    expect(await cestaOneAndTheCount(marco)).toEqual({
      state: "disponibile",
      disponibili: 10,
    });

    const cesteIds = await takeAway(marco, clienteId, ["1"]);
    expect(await cestaOneAndTheCount(marco)).toEqual({
      state: "fuori",
      disponibili: 9,
    });

    await marco.mutation(api.movimenti.rientro, { clienteId, cesteIds });
    expect(await cestaOneAndTheCount(marco)).toEqual({
      state: "attesa_molitura",
      disponibili: 9,
    });

    await marco.mutation(api.movimenti.svuotamento, { cesteIds });
    expect(await cestaOneAndTheCount(marco)).toEqual({
      state: "disponibile",
      disponibili: 10,
    });
    expect(await marco.query(api.ceste.attesaMolitura, {})).toEqual([]);
  });

  test("a stack of five is emptied in one tap, under one Registro row and no Cliente", async () => {
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
    const his = await bringBack(marco, giuseppe, ["1", "2", "3"]);
    const hers = await bringBack(marco, salvatore, ["4", "5"]);

    // Whoever empties them selects both stacks and taps once.
    await marco.mutation(api.movimenti.svuotamento, {
      cesteIds: [...his, ...hers],
    });

    const histories = await Promise.all(
      [...his, ...hers].map((cestaId) =>
        marco.query(api.movimenti.byCesta, { cestaId }),
      ),
    );
    const svuotamenti = histories.map((history) =>
      history.filter((movimento) => movimento.kind === "svuotamento"),
    );
    // One Svuotamento Movimento per Cesta, all of them under the one Registro
    // row that says what the Operatore did (ADR-0006).
    expect(svuotamenti.map((one) => one.length)).toEqual([1, 1, 1, 1, 1]);
    expect(
      new Set(svuotamenti.flat().map((movimento) => movimento.registroId)).size,
    ).toBe(1);
    // A Svuotamento carries no Cliente: the tape comes off and the Cesta is
    // nobody's again.
    expect(
      svuotamenti.flat().every((movimento) => movimento.cliente === null),
    ).toBe(true);
    // Every one of them was where the app believed, so nothing was corrected.
    expect(
      histories.flat().some((movimento) => movimento.kind === "rettifica"),
    ).toBe(false);

    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Marco",
      cliente: null,
      campagna: null,
      action: { kind: "svuotamento", numeri: [1, 2, 3, 4, 5] },
    });
    expect(await marco.query(api.ceste.attesaMolitura, {})).toEqual([]);
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 10 },
      { portata: 250, count: 0 },
    ]);
  });

  test("a Cesta the app believed Fuori is emptied anyway, with a Rettifica beside her", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await takeAway(marco, clienteId, ["3"]);

    // Nobody registered her Rientro, and she is standing full in the mill
    // regardless: no mutation refuses a Cesta for the state she is in
    // (ADR-0005).
    await marco.mutation(api.movimenti.svuotamento, { cesteIds: [cestaId] });

    const ceste = await marco.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 3)?.state).toBe(
      "disponibile",
    );
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 10 },
      { portata: 250, count: 0 },
    ]);

    const history = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(history).toContainEqual({
      kind: "rettifica",
      // Where the app had her, and with whom: the belief the Svuotamento
      // corrected, written down beside what actually happened.
      rettifica: {
        cause: "discrepanza",
        believedState: "fuori",
        becomes: "disponibile",
      },
      cliente: { name: "Giuseppe Amato", alias: [] },
      operatore: "Marco",
      at: expect.any(Number),
      campagna: null,
      registroId: expect.any(String),
    });
    // The Rettifica and the Svuotamento are one action (ADR-0006).
    const moved = history.filter(
      (movimento) =>
        movimento.kind !== "ritiro" && movimento.kind !== "rientro",
    );
    expect(moved.map((movimento) => movimento.kind).sort()).toEqual([
      "rettifica",
      "svuotamento",
    ]);
    expect(new Set(moved.map((movimento) => movimento.registroId)).size).toBe(
      1,
    );
    // And she stops being counted against him.
    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      cesteFuori: [],
    });
  });

  test("a Cesta the app believed Disponibile is emptied too, and is counted once", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const cestaId = await typeNumero(marco, "7");

    await marco.mutation(api.movimenti.svuotamento, { cesteIds: [cestaId] });

    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 10 },
      { portata: 250, count: 0 },
    ]);
    expect(
      await marco.query(api.movimenti.byCesta, { cestaId }),
    ).toContainEqual({
      kind: "rettifica",
      rettifica: {
        cause: "discrepanza",
        believedState: "disponibile",
        becomes: "disponibile",
      },
      // Nobody was holding her, so the Rettifica names nobody either.
      cliente: null,
      operatore: "Marco",
      at: expect.any(Number),
      campagna: null,
      registroId: expect.any(String),
    });
  });

  test("the yard reads as one group per Cliente, oldest Rientro first", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });
    const salvatore = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });

    expect(await marco.query(api.ceste.attesaMolituraByCliente, {})).toEqual(
      [],
    );
    const his = await bringBack(marco, giuseppe, ["4", "1"]);
    await bringBack(marco, salvatore, ["2"]);
    // A second load of his, a day later: one Cliente with Ceste from several
    // Rientri is still one group.
    const alsoHis = await bringBack(marco, giuseppe, ["7"]);

    const groups = await marco.query(api.ceste.attesaMolituraByCliente, {});
    expect(
      groups.map((group) => [
        group.cliente?.name,
        group.ceste.map((cesta) => cesta.numero),
      ]),
    ).toEqual([
      ["Giuseppe Amato", [1, 4, 7]],
      ["Salvatore Russo", [2]],
    ]);
    expect(groups[0].cliente).toMatchObject({ alias: ["Turi"] });
    expect(groups[0].ceste[0]).toEqual({
      _id: his[1],
      numero: 1,
      codice: "400-R-001",
      portata: 400,
    });

    // The date on a group's header is the oldest Rientro in it, not the newest.
    const rientroAt = async (cestaId: Id<"ceste">) =>
      (await marco.query(api.movimenti.byCesta, { cestaId })).find(
        (movimento) => movimento.kind === "rientro",
      )!.at;
    expect(groups[0].oldestRientro).toBe(await rientroAt(his[0]));
    expect(groups[0].oldestRientro).toBeLessThan(await rientroAt(alsoHis[0]));
    expect(groups[0].oldestRientro!).toBeLessThan(groups[1].oldestRientro!);
  });

  test("a Svuotamento of none is refused, and the same Cesta twice is emptied once", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await bringBack(marco, clienteId, ["3"]);

    await expect(
      marco.mutation(api.movimenti.svuotamento, { cesteIds: [] }),
    ).rejects.toThrow();
    // Tapped on a tile and then typed on the keypad is one Cesta emptied once.
    await marco.mutation(api.movimenti.svuotamento, {
      cesteIds: [cestaId, cestaId],
    });

    expect(
      (await marco.query(api.movimenti.byCesta, { cestaId })).filter(
        (movimento) => movimento.kind === "svuotamento",
      ),
    ).toHaveLength(1);
  });

  test("nobody signed in empties a Cesta, or reads the yard by Cliente", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await bringBack(gabriele, clienteId, ["1"]);

    await expect(
      t.mutation(api.movimenti.svuotamento, { cesteIds: [cestaId] }),
    ).rejects.toThrow();
    await expect(
      t.query(api.ceste.attesaMolituraByCliente, {}),
    ).rejects.toThrow();
    await expect(t.query(api.movimenti.byCesta, { cestaId })).rejects.toThrow();
  });
});

describe("a Rettifica", () => {
  test("a Cesta lost to a Cliente is written off: Dismessa, and off his hands", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await takeAway(gabriele, clienteId, ["3"]);

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "persa",
      note: "Dice che gliel'hanno rubata dal campo.",
    });

    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 3)?.state).toBe("dismessa");
    // She stops being counted against him: only a Rientro or a Rettifica ever
    // takes a Cesta off the Lista di recupero (CONTEXT.md).
    expect(await gabriele.query(api.clienti.get, { clienteId })).toMatchObject({
      cesteFuori: [],
    });

    const history = await gabriele.query(api.movimenti.byCesta, { cestaId });
    expect(history[0]).toEqual({
      kind: "rettifica",
      // Why she left the fleet, where the app had her, and where the Rettifica
      // leaves her: the explanation ADR-0004 refuses to do without.
      rettifica: {
        cause: "persa",
        believedState: "fuori",
        becomes: "dismessa",
        note: "Dice che gliel'hanno rubata dal campo.",
      },
      // The Cliente the app believed was holding her, so that the correction
      // reads in his own history too.
      cliente: { name: "Giuseppe Amato", alias: [] },
      operatore: "Gabriele",
      at: expect.any(Number),
      campagna: null,
      registroId: expect.any(String),
    });
    // The Rettifica is an action a person took, and says so in the Registro
    // under the same row the Movimento carries (ADR-0006, #27).
    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: history[0].registroId,
      at: expect.any(Number),
      operatore: "Gabriele",
      cliente: { name: "Giuseppe Amato", alias: [] },
      campagna: null,
      action: {
        kind: "rettifica",
        numero: 3,
        cause: "persa",
        becomes: "dismessa",
        note: "Dice che gliel'hanno rubata dal campo.",
      },
    });
  });

  test("a Cesta that turned up at a Cliente's is Fuori with him, from the day she was found", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const giuseppe = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const salvatore = await gabriele.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    // She went out with Giuseppe, was given up for lost, and turned up in
    // Salvatore's yard months later.
    const [cestaId] = await takeAway(gabriele, giuseppe, ["5"]);
    const ritiroAt = (
      await gabriele.query(api.movimenti.byCesta, { cestaId })
    ).find((movimento) => movimento.kind === "ritiro")!.at;
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "persa",
    });

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "ritrovata",
      clienteId: salvatore,
      note: "Era dietro il capannone di Salvatore.",
    });

    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 5)?.state).toBe("fuori");
    // She is his now, and nobody else's: Giuseppe stopped holding her the day
    // she was written off.
    expect(
      await gabriele.query(api.clienti.get, { clienteId: giuseppe }),
    ).toMatchObject({ cesteFuori: [] });
    const his = await gabriele.query(api.clienti.get, {
      clienteId: salvatore,
    });
    expect(his?.cesteFuori.map((cesta) => cesta.numero)).toEqual([5]);
    // And she has been Fuori since the Rettifica, not since a Ritiro he never
    // made: the days the mill will chase him for start the day she was found.
    const rettificaAt = (
      await gabriele.query(api.movimenti.byCesta, { cestaId })
    )[0].at;
    expect(his?.cesteFuori[0].since).toBe(rettificaAt);
    expect(his?.cesteFuori[0].since).toBeGreaterThan(ritiroAt);
  });

  test("a Cesta broken at the mill and one lost to a Cliente are counted apart", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [persa] = await takeAway(gabriele, clienteId, ["3"]);
    const rotta = await typeNumero(gabriele, "7");

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId: persa,
      cause: "persa",
    });
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId: rotta,
      cause: "rotta",
      note: "Si è spaccata scaricandola.",
    });

    // Two Ceste out of the fleet, and the one that was still at the mill
    // leaves the Disponibili one short.
    const ceste = await gabriele.query(api.ceste.list, {});
    expect(
      ceste
        .filter((cesta) => cesta.state === "dismessa")
        .map((cesta) => cesta.numero),
    ).toEqual([3, 7]);
    expect(await gabriele.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 8 },
      { portata: 250, count: 0 },
    ]);

    // Lost to a Cliente and broken at the mill are two facts, and the Registro
    // counts them apart: the mill asked for exactly this (ADR-0004).
    const rettifiche = (await gabriele.query(api.registro.list, {})).flatMap(
      (row) => (row.action.kind === "rettifica" ? [row.action] : []),
    );
    expect(rettifiche.filter((one) => one.cause === "persa")).toHaveLength(1);
    expect(rettifiche.filter((one) => one.cause === "rotta")).toHaveLength(1);
    expect(rettifiche.find((one) => one.cause === "rotta")?.note).toBe(
      "Si è spaccata scaricandola.",
    );
  });

  test("a Cesta that turned up at the mill is Disponibile again, with her whole history behind her", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await bringBack(gabriele, clienteId, ["2"]);
    await gabriele.mutation(api.movimenti.svuotamento, { cesteIds: [cestaId] });
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "rotta",
    });
    expect(await gabriele.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 9 },
      { portata: 250, count: 0 },
    ]);

    // She was mended, or she was never as broken as somebody thought.
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "ritrovata",
    });

    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 2)?.state).toBe(
      "disponibile",
    );
    expect(await gabriele.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 10 },
      { portata: 250, count: 0 },
    ]);
    // Nothing was deleted on the way round: every Movimento she ever had is
    // still there to read, the two Rettifiche among them (ADR-0004).
    const history = await gabriele.query(api.movimenti.byCesta, { cestaId });
    expect(history.map((movimento) => movimento.kind)).toEqual([
      "rettifica",
      "rettifica",
      "svuotamento",
      "rientro",
      "ritiro",
    ]);
    expect(history[0].rettifica).toEqual({
      cause: "ritrovata",
      believedState: "dismessa",
      becomes: "disponibile",
    });
    // She is nobody's: a Cesta at the mill is in no Cliente's hands.
    expect(await gabriele.query(api.clienti.get, { clienteId })).toMatchObject({
      cesteFuori: [],
    });
  });

  test("a Dismessa Cesta leaves the yard and every count, and is still found by her numero", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await bringBack(gabriele, clienteId, ["4"]);

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "rotta",
      note: "Il fondo è andato.",
    });

    // Out of the yard she was standing in, and out of the groups it is emptied
    // by: a retired Cesta is in no picker (spec #1, story 38).
    expect(await gabriele.query(api.ceste.attesaMolitura, {})).toEqual([]);
    expect(await gabriele.query(api.ceste.attesaMolituraByCliente, {})).toEqual(
      [],
    );
    expect(await gabriele.query(api.ceste.fuoriByCliente, {})).toEqual([]);
    // The fleet screen keeps her: she is part of what the mill owns and of
    // what became of it (ADR-0004).
    expect(await gabriele.query(api.ceste.list, {})).toContainEqual({
      numero: 4,
      codice: "400-R-004",
      portata: 400,
      forma: "rettangolare",
      state: "dismessa",
    });
    // And a typed numero still answers with her, so that a counter screen can
    // say what she is rather than pretend she never existed (ADR-0005, #21).
    expect(await gabriele.query(api.ceste.byNumero, { numero: "4" })).toEqual({
      _id: cestaId,
      numero: 4,
      codice: "400-R-004",
      portata: 400,
      state: "dismessa",
      cliente: null,
    });
  });

  test("a written-off Cesta emptied at the mill stays written off, with the Rettifica that says she turned up", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await takeAway(marco, clienteId, ["6"]);
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "persa",
    });

    // She comes back full months later and is tipped out with the rest. That
    // is not whoever empties her deciding she is back in the fleet: only an
    // Admin's *ritrovata* does that (#18, #20).
    await marco.mutation(api.movimenti.svuotamento, { cesteIds: [cestaId] });

    const ceste = await marco.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 6)?.state).toBe("dismessa");
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 9 },
      { portata: 250, count: 0 },
    ]);
    // The Svuotamento is written down all the same, and the discrepanza beside
    // it is the only thing saying she turned up at all.
    const history = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(history.map((movimento) => movimento.kind)).toEqual([
      "svuotamento",
      "rettifica",
      "rettifica",
      "ritiro",
    ]);
    expect(history[1].rettifica).toEqual({
      cause: "discrepanza",
      believedState: "dismessa",
      becomes: "dismessa",
    });
  });

  test("a written-off Cesta that turns up at the counter goes out anyway, with the Rettifica that says so", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cestaId = await typeNumero(marco, "8");
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "rotta",
    });

    // She is in the yard and the Cliente is loading her: nothing at the counter
    // refuses a Cesta for the state she is in (ADR-0005).
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [cestaId],
    });

    // The Ritiro is registered, and she is still out of the fleet: putting her
    // back is an Admin's *ritrovata* and nobody else's (#20).
    const ceste = await marco.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 8)?.state).toBe("dismessa");
    const history = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(history.map((movimento) => movimento.kind)).toEqual([
      "ritiro",
      "rettifica",
      "rettifica",
    ]);
    expect(history[1].rettifica).toEqual({
      cause: "discrepanza",
      believedState: "dismessa",
      becomes: "dismessa",
    });
    // The Ritiro and the Rettifica beside it are one action (ADR-0006).
    expect(history[0].registroId).toBe(history[1].registroId);
    // And she is not counted against him, because the app does not have her to
    // count: her page says a Ritiro was registered on a Cesta it had written
    // off, which is the fact the mill would otherwise never see.
    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      cesteFuori: [],
    });
  });

  test("a Rettifica with no cause is refused, and so is a cause that names a Cliente it should not", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await takeAway(gabriele, clienteId, ["1"]);

    // The reason is what a Rettifica is for, and the argument validator is
    // what refuses one without it — not the form (ADR-0004).
    await expect(
      // @ts-expect-error a Rettifica with no cause is not a Rettifica.
      gabriele.mutation(api.movimenti.rettifica, { cestaId }),
    ).rejects.toThrow();
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId,
        // @ts-expect-error the app writes a discrepanza; no Admin chooses one.
        cause: "discrepanza",
      }),
    ).rejects.toThrow();
    // Only a Cesta that turned up again is somewhere in particular.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId,
        cause: "persa",
        clienteId,
      }),
    ).rejects.toThrow();

    // Nothing of the refusals was written: she is still Fuori with him.
    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 1)?.state).toBe("fuori");
    expect(
      (await gabriele.query(api.movimenti.byCesta, { cestaId })).map(
        (movimento) => movimento.kind,
      ),
    ).toEqual(["ritiro"]);
  });

  test("the counter cannot write a Cesta off: a Rettifica is an Admin's", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const cestaId = await typeNumero(marco, "9");

    await expect(
      marco.mutation(api.movimenti.rettifica, { cestaId, cause: "rotta" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.movimenti.rettifica, { cestaId, cause: "rotta" }),
    ).rejects.toThrow();

    const ceste = await marco.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 9)?.state).toBe(
      "disponibile",
    );
  });
});
