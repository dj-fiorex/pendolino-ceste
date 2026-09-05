/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses: no table is read or written directly, and nothing is mocked
// (spec #1). The highlighting itself is drawn on the device from the Soglia and
// the dates this list hands back, and is not tested here.
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

/** A fleet to hand out: twelve Ceste of 400 kg, numeri 1 to 12. */
const aFleetOfTwelve = async (gabriele: Device) => {
  await gabriele.mutation(api.ceste.censimento, {
    portata: 400,
    forma: "rettangolare",
    count: 12,
  });
};

/** A Ritiro of the numeri given, so that somebody is holding Ceste. */
const takeAway = async (
  device: Device,
  clienteId: Id<"clienti">,
  numeri: string[],
) => {
  const cesteIds = [];
  for (const numero of numeri) {
    const cesta = await device.query(api.ceste.byNumero, { numero });
    if (cesta === null) {
      throw new Error(`No Cesta answers to the numero ${numero}.`);
    }
    cesteIds.push(cesta._id);
  }
  await device.mutation(api.movimenti.ritiro, { clienteId, cesteIds });
  return cesteIds;
};

/** The names on the Lista di recupero, in the order it puts them. */
const namesOn = (list: { clienti: { cliente: { name: string } }[] }) =>
  list.clienti.map((row) => row.cliente.name);

describe("the Soglia di ritardo", () => {
  test("is ten days before an Admin has ever set one", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    expect(await gabriele.query(api.recupero.list, {})).toEqual({
      sogliaRitardo: 10,
      clienti: [],
    });
  });

  test("reads back as the Admin set it, with the change in the Registro", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 14 });

    expect((await gabriele.query(api.recupero.list, {})).sogliaRitardo).toBe(
      14,
    );
    expect(await gabriele.query(api.registro.list, {})).toEqual([
      {
        _id: expect.any(String),
        at: expect.any(Number),
        operatore: "Gabriele",
        cliente: null,
        campagna: null,
        producedRettifica: false,
        corrects: null,
        correctedBy: [],
        media: { signature: null, photo: null },
        sms: null,
        action: { kind: "soglia_ritardo", before: 10, after: 14 },
      },
    ]);
  });

  test("setting it to what it already says records nothing", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 14 });

    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 14 });

    expect(await gabriele.query(api.registro.list, {})).toHaveLength(1);
    expect((await gabriele.query(api.recupero.list, {})).sogliaRitardo).toBe(
      14,
    );
  });

  test("leaves the Etichetta settings alone, and they leave it alone", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.etichette.setSettings, {
      etichettaSize: "a6",
      millName: "Frantoio Pendolino",
      millNameOnEtichetta: true,
      millPhone: "0931 000 000",
      millPhoneOnEtichetta: false,
    });

    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 21 });

    expect(await gabriele.query(api.etichette.settings, {})).toEqual({
      etichettaSize: "a6",
      millName: "Frantoio Pendolino",
      millNameOnEtichetta: true,
      millPhone: "0931 000 000",
      millPhoneOnEtichetta: false,
    });
    expect((await gabriele.query(api.recupero.list, {})).sogliaRitardo).toBe(
      21,
    );
  });

  test("is settled first without deciding anything about the Etichetta", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    // The two share the one row the whole mill's settings live in. Writing
    // that row for the Soglia must not settle the Etichetta by the way: it
    // still says what the app says until an Admin says otherwise.
    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 21 });

    expect(await gabriele.query(api.etichette.settings, {})).toEqual({
      etichettaSize: "100x150",
      millName: "",
      millNameOnEtichetta: true,
      millPhone: "",
      millPhoneOnEtichetta: true,
    });
    expect(await gabriele.query(api.registro.list, {})).toHaveLength(1);
  });

  test("is a number of whole days, and at least one", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.recupero.setSogliaRitardo, { days: 0 }),
    ).rejects.toThrow();
    await expect(
      gabriele.mutation(api.recupero.setSogliaRitardo, { days: -3 }),
    ).rejects.toThrow();
    await expect(
      gabriele.mutation(api.recupero.setSogliaRitardo, { days: 7.5 }),
    ).rejects.toThrow();

    expect((await gabriele.query(api.recupero.list, {})).sogliaRitardo).toBe(
      10,
    );
    expect(await gabriele.query(api.registro.list, {})).toEqual([]);
  });

  test("is an Admin's to set, and every Operatore's to read", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 14 });
    const marco = await operatore(t);

    await expect(
      marco.mutation(api.recupero.setSogliaRitardo, { days: 30 }),
    ).rejects.toThrow();

    expect((await marco.query(api.recupero.list, {})).sogliaRitardo).toBe(14);
    await expect(t.query(api.recupero.list, {})).rejects.toThrow();
  });
});

describe("the Lista di recupero", () => {
  test("names the Cliente, the Ceste he holds and the telephone to call", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
      phone: "0931 000 000",
    });
    await takeAway(marco, clienteId, ["1", "2", "3"]);

    const list = await marco.query(api.recupero.list, {});

    expect(list.clienti).toEqual([
      {
        cliente: {
          _id: clienteId,
          name: "Giuseppe Amato",
          alias: ["Turi"],
          phone: "+390931000000",
          smsOptOut: false,
        },
        active: true,
        since: expect.any(Number),
        ceste: [
          { _id: expect.any(String), numero: 1, since: expect.any(Number) },
          { _id: expect.any(String), numero: 2, since: expect.any(Number) },
          { _id: expect.any(String), numero: 3, since: expect.any(Number) },
        ],
      },
    ]);
    // The row is as old as the oldest Cesta on it: that is how long this
    // Cliente has been holding something of the mill's.
    expect(list.clienti[0].since).toBe(
      Math.min(
        ...list.clienti[0].ceste.map((cesta) => cesta.since ?? Infinity),
      ),
    );
  });

  test("says nothing about a Cliente holding nothing", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cesteIds = await takeAway(marco, clienteId, ["1", "2"]);
    await marco.mutation(api.clienti.create, { name: "Rosa Lo Bianco" });

    await marco.mutation(api.movimenti.rientro, { clienteId, cesteIds });

    expect(await marco.query(api.recupero.list, {})).toEqual({
      sogliaRitardo: 10,
      clienti: [],
    });
  });

  test("puts the longest wait first, whatever the numeri say", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });
    const bruno = await marco.mutation(api.clienti.create, { name: "Bruno" });
    const carla = await marco.mutation(api.clienti.create, { name: "Carla" });

    // Anna took hers first and Carla last, so Anna heads the list — and the
    // numeri run the other way, so no read of them could produce this order.
    await takeAway(marco, anna, ["9"]);
    await takeAway(marco, bruno, ["5"]);
    await takeAway(marco, carla, ["1", "2"]);

    expect(namesOn(await marco.query(api.recupero.list, {}))).toEqual([
      "Anna",
      "Bruno",
      "Carla",
    ]);
  });

  test("dates a Cliente by his oldest Cesta, not by his newest", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });
    const bruno = await marco.mutation(api.clienti.create, { name: "Bruno" });

    await takeAway(marco, anna, ["1"]);
    await takeAway(marco, bruno, ["2"]);
    // Anna comes back for more. Her oldest Cesta is still the oldest of the
    // two Clienti's, so she stays at the top: coming back for more is not a
    // way of falling down the list.
    await takeAway(marco, anna, ["3"]);

    expect(namesOn(await marco.query(api.recupero.list, {}))).toEqual([
      "Anna",
      "Bruno",
    ]);
  });
});

describe("what the Soglia di ritardo does to the Lista di recupero", () => {
  test("nothing at all: the same names, the same Ceste, the same order", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });
    const bruno = await marco.mutation(api.clienti.create, { name: "Bruno" });
    await takeAway(marco, anna, ["1", "2"]);
    await takeAway(marco, bruno, ["3"]);

    // Everybody is late at one day, nobody is at a thousand. Both readings of
    // the mill are the same list: the Soglia colours rows, it does not choose
    // them (#22).
    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 1 });
    const whenEverybodyIsLate = await marco.query(api.recupero.list, {});
    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 1000 });
    const whenNobodyIs = await marco.query(api.recupero.list, {});

    expect(whenEverybodyIsLate.sogliaRitardo).toBe(1);
    expect(whenNobodyIs.sogliaRitardo).toBe(1000);
    expect(whenNobodyIs.clienti).toEqual(whenEverybodyIsLate.clienti);
    expect(namesOn(whenNobodyIs)).toEqual(["Anna", "Bruno"]);
  });

  test("a Cliente who took Ceste this morning is on the list already", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    await gabriele.mutation(api.recupero.setSogliaRitardo, { days: 30 });
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });

    await takeAway(marco, anna, ["1"]);

    // Twenty-nine days inside the Soglia, and on the list all the same: it is
    // a list of who is holding Ceste, not a list of who is late.
    expect(namesOn(await marco.query(api.recupero.list, {}))).toEqual(["Anna"]);
  });
});

describe("a Cliente the mill has written off", () => {
  test("stays on the Lista di recupero as long as he holds Ceste", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });
    const cesteIds = await takeAway(marco, anna, ["1", "2"]);

    await gabriele.mutation(api.clienti.deactivate, {
      clienteId: anna,
      confirmed: true,
    });

    const list = await marco.query(api.recupero.list, {});
    expect(namesOn(list)).toEqual(["Anna"]);
    // He is gone from every picker and every search, and the row says as much
    // — but the Ceste are still his and still counted against him (ADR-0004).
    expect(list.clienti[0].active).toBe(false);
    expect(list.clienti[0].ceste.map((cesta) => cesta.numero)).toEqual([1, 2]);
    expect(await marco.query(api.clienti.search, { term: "anna" })).toEqual([]);

    // Only a Rientro or a Rettifica takes him off it.
    await marco.mutation(api.movimenti.rientro, { clienteId: anna, cesteIds });
    expect((await marco.query(api.recupero.list, {})).clienti).toEqual([]);
  });
});

// What the Ritiro screen reads to warn the Operatore, before anything is
// confirmed, that the Cliente in front of him already has Ceste out. It is the
// Cliente's own read, the one the Rientro and the Cliente's page make (#17).
describe("the warning at the counter", () => {
  test("names the Ceste a Cliente already has, each dated by the Ritiro that took it out", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });

    await takeAway(marco, anna, ["1", "2"]);
    await takeAway(marco, anna, ["7"]);

    const held = await marco.query(api.clienti.get, { clienteId: anna });
    expect(held?.cesteFuori.map((cesta) => cesta.numero)).toEqual([1, 2, 7]);
    // Each is dated by the Ritiro that took her out, not by the Cliente's
    // oldest: the two of the first trip are older than the one of the second.
    // That is the answer to a Cliente who remembers two when the app says
    // three — which ones, and since when (#22).
    const [one, two, seven] = held?.cesteFuori ?? [];
    expect(one.since).not.toBeNull();
    expect(seven.since).toBeGreaterThan(one.since ?? 0);
    expect(seven.since).toBeGreaterThan(two.since ?? 0);
  });

  test("never blocks the Ritiro: he takes six more and holds nine", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });
    await takeAway(marco, anna, ["1", "2", "3"]);

    await takeAway(marco, anna, ["4", "5", "6", "7", "8", "9"]);

    const held = await marco.query(api.clienti.get, { clienteId: anna });
    expect(held?.cesteFuori.map((cesta) => cesta.numero)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(
      (await marco.query(api.recupero.list, {})).clienti[0].ceste,
    ).toHaveLength(9);
  });

  test("keeps the day a Cesta really went out when a Rettifica puts a wrong Ritiro right", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTwelve(gabriele);
    const marco = await operatore(t);
    const anna = await marco.mutation(api.clienti.create, { name: "Anna" });
    const bruno = await marco.mutation(api.clienti.create, { name: "Bruno" });
    const [cestaId] = await takeAway(marco, anna, ["1"]);
    const tookHerOut = (await marco.query(api.clienti.get, { clienteId: anna }))
      ?.cesteFuori[0].since;

    // She went to Bruno, not to Anna, and the Admin says so in the afternoon.
    // Bruno has had her since the morning she was loaded: the mill must chase
    // the days it has already lost, not start counting again (#28).
    const [wrongRitiro] = await marco.query(api.movimenti.byCesta, { cestaId });
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "errore",
      becomes: "fuori",
      clienteId: bruno,
      corrects: wrongRitiro._id,
    });

    const held = await marco.query(api.clienti.get, { clienteId: bruno });
    expect(held?.cesteFuori[0].since).toBe(tookHerOut);
    expect(namesOn(await marco.query(api.recupero.list, {}))).toEqual([
      "Bruno",
    ]);
  });
});
