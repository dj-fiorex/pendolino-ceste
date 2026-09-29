/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema, { dayBounds, todayAtTheMill } from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses: no table is read or written directly, and nothing is mocked
// (spec #1). The Italian sentences the screen renders from these rows are drawn
// on the device, outside that seam, and are not tested here.
//
// The one exception is `dayBounds`, which the screen and the query agree on and
// which no read through the seam could catch the far end of: a Campagna runs
// October to March and crosses both nights the clocks change.
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
const operatore = async (
  t: TestConvex<typeof schema>,
  name: string,
  authUserId: string,
) => {
  await t.mutation(internal.operatori.create, {
    authUserId,
    name,
    email: `${name.toLowerCase()}@frantoio.example`,
    role: "operatore",
  });
  return t.withIdentity({ subject: authUserId });
};

type Device = Awaited<ReturnType<typeof admin>>;

/**
 * The two instants a day runs between, as the screen sends them: built out of a
 * local Date, which is the device's day and so the mill's.
 */
const dayAfter = (shiftInDays: number) => {
  const now = new Date();
  const start = (offset: number) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
    ).getTime();
  return { from: start(shiftInDays), to: start(shiftInDays + 1) };
};

const today = () => dayAfter(0);
const yesterday = () => dayAfter(-1);

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

const kindsOf = (rows: { action: { kind: string } }[]) =>
  rows.map((row) => row.action.kind);

describe("the Registro of a day", () => {
  test("is every action of it, newest first, with who did it and when", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");
    const { _id: clienteId } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });

    const day = today();
    const rows = await gabriele.query(api.registro.list, { day });

    expect(kindsOf(rows)).toEqual(["ritiro", "cliente_creato", "censimento"]);
    expect(rows.map((row) => row.operatore)).toEqual([
      "Marco",
      "Marco",
      "Gabriele",
    ]);
    // The Cliente as the registry has them now, so that a Ritiro reads the way
    // the counter would say it: "a Giuseppe Amato (Turi)".
    expect(rows[0].cliente).toEqual({
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });
    // A Censimento concerns no Cliente.
    expect(rows[2].cliente).toBeNull();
    expect(rows.every((row) => row.at >= day.from && row.at < day.to)).toBe(
      true,
    );
  });

  test("a Ritiro of six Ceste is one row, and its six Movimenti point at it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");
    const { _id: clienteId } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    const cesteIds = [];
    for (const numero of ["1", "2", "3", "4", "5", "6"]) {
      cesteIds.push(await typeNumero(marco, numero));
    }
    await marco.mutation(api.movimenti.ritiro, { clienteId, cesteIds });

    const rows = await gabriele.query(api.registro.list, { day: today() });
    const ritiri = rows.filter((row) => row.action.kind === "ritiro");
    expect(ritiri).toHaveLength(1);
    expect(ritiri[0].action).toEqual({
      kind: "ritiro",
      numeri: [1, 2, 3, 4, 5, 6],
    });

    const movimenti = await marco.query(api.movimenti.byCliente, { clienteId });
    expect(movimenti).toHaveLength(6);
    expect(
      movimenti.every((movimento) => movimento.registroId === ritiri[0]._id),
    ).toBe(true);
  });

  test("a telephone corrected is one row, with what it said before and after", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t, "Marco", "auth|marco");
    const { _id: clienteId } = await marco.mutation(api.clienti.create, {
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

    const rows = await gabriele.query(api.registro.list, { day: today() });
    expect(rows[0]).toEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Marco",
      cliente: { name: "Giuseppe Amato", alias: [] },
      campagna: null,
      producedRettifica: false,
      discrepanze: [],
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
      action: {
        kind: "cliente_modificato",
        changes: [
          { field: "phone", before: "+393331112222", after: "+393339998888" },
        ],
      },
    });
  });

  test("another day holds none of it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);

    expect(
      await gabriele.query(api.registro.list, { day: today() }),
    ).toHaveLength(1);
    expect(
      await gabriele.query(api.registro.list, { day: yesterday() }),
    ).toEqual([]);
    expect(
      await gabriele.query(api.registro.filterOptions, { day: yesterday() }),
    ).toEqual({ clienti: [], operatori: [] });
  });
});

/**
 * A Rettifica of *errore* and the action it puts right are two rows, and the
 * Registro is read for either of them: what was registered wrongly, and what
 * says so. Neither row is ever rewritten to name the other (ADR-0004, #28).
 */
describe("a correction and the action it corrects", () => {
  test("each of the two rows names the other", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");
    const { _id: giuseppe } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cesteIds = [
      await typeNumero(marco, "4"),
      await typeNumero(marco, "5"),
    ];
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: giuseppe,
      cesteIds,
    });
    // The second was scanned off the stack and never went on the trailer.
    const [, scannedByMistake] = cesteIds;
    const ritiro = (
      await gabriele.query(api.movimenti.byCesta, {
        cestaId: scannedByMistake,
      })
    ).find((movimento) => movimento.kind === "ritiro");

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId: scannedByMistake,
      cause: "errore",
      corrects: ritiro!._id,
      becomes: "disponibile",
    });

    const rows = await gabriele.query(api.registro.list, { day: today() });
    const correction = rows.find((row) => row.action.kind === "rettifica")!;
    const corrected = rows.find((row) => row.action.kind === "ritiro")!;

    // The Rettifica's row names the action it corrects…
    expect(correction.corrects).toEqual({
      _id: corrected._id,
      at: corrected.at,
      kind: "ritiro",
    });
    // …and the Ritiro's row reads as corrected by it, while still saying
    // exactly what Marco did that morning, to both Ceste (ADR-0004).
    expect(corrected.correctedBy).toEqual([
      { _id: correction._id, at: correction.at, numero: 5 },
    ]);
    expect(corrected.action).toEqual({ kind: "ritiro", numeri: [4, 5] });
    expect(corrected.operatore).toBe("Marco");
    // The Rettifica is an action that produced a Rettifica; the Ritiro is not.
    // That flag says what an action left behind it as it went through, not
    // what somebody did about it days later (#21).
    expect(correction.producedRettifica).toBe(true);
    expect(corrected.producedRettifica).toBe(false);

    // And nothing else of the day is either half of a pair.
    expect(rows.filter((row) => row.corrects !== null)).toHaveLength(1);
    expect(rows.filter((row) => row.correctedBy.length > 0)).toHaveLength(1);
  });
});

describe("narrowing the Registro", () => {
  /**
   * A morning at the counter: two Operatori, two Clienti, and every kind of
   * action the app can write by now.
   */
  const aMorning = async (t: TestConvex<typeof schema>) => {
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");
    const rosa = await operatore(t, "Rosa", "auth|rosa");

    const { _id: giuseppe } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const { _id: salvatore } = await rosa.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: giuseppe,
      cesteIds: [await typeNumero(marco, "1")],
    });
    await rosa.mutation(api.clienti.update, {
      clienteId: giuseppe,
      name: "Giuseppe Amato",
      alias: [],
      phone: "333 111 2222",
      smsOptOut: false,
    });

    return { gabriele, giuseppe, salvatore };
  };

  test("by Cliente leaves only what concerned them", async () => {
    const t = startApp();
    const { gabriele, giuseppe, salvatore } = await aMorning(t);

    const day = today();
    expect(
      kindsOf(
        await gabriele.query(api.registro.list, { day, clienteId: giuseppe }),
      ),
    ).toEqual(["cliente_modificato", "ritiro", "cliente_creato"]);
    expect(
      kindsOf(
        await gabriele.query(api.registro.list, { day, clienteId: salvatore }),
      ),
    ).toEqual(["cliente_creato"]);
  });

  test("by Cliente includes a grouped discrepancy that names them", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");
    const { _id: abissi } = await marco.mutation(api.clienti.create, {
      name: "Abissi Vincenzo",
    });
    const { _id: carmelo } = await marco.mutation(api.clienti.create, {
      name: "Carmelo Fiorello",
    });
    const cestaId = await typeNumero(marco, "2");
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: abissi,
      cesteIds: [cestaId],
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: carmelo,
      cesteIds: [cestaId],
    });

    const rows = await gabriele.query(api.registro.list, {
      day: today(),
      clienteId: abissi,
    });
    const grouped = rows.find(
      (row) =>
        row.action.kind === "ritiro" &&
        row.cliente?.name === "Carmelo Fiorello",
    );

    expect(grouped?.discrepanze).toEqual([
      {
        numero: 2,
        believedState: "fuori",
        becomes: "fuori",
        cliente: { name: "Abissi Vincenzo", alias: [] },
      },
    ]);
  });

  test("Solo rettifiche includes manual and automatic Rettifiche", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");
    const { _id: giuseppe } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const { _id: salvatore } = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    const cestaId = await typeNumero(marco, "2");
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: giuseppe,
      cesteIds: [cestaId],
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId: await typeNumero(gabriele, "7"),
      cause: "rotta",
    });

    expect(
      kindsOf(
        await gabriele.query(api.registro.list, {
          day: today(),
          producedRettifica: true,
        }),
      ),
    ).toEqual(["rettifica", "ritiro"]);
  });

  test("by Operatore leaves only what they did", async () => {
    const t = startApp();
    const { gabriele } = await aMorning(t);

    const day = today();
    const { operatori } = await gabriele.query(api.registro.filterOptions, {
      day,
    });
    const marco = operatori.find((one) => one.name === "Marco");
    const rosa = operatori.find((one) => one.name === "Rosa");
    if (marco === undefined || rosa === undefined) {
      throw new Error("The morning's Operatori are not in the filters.");
    }

    expect(
      kindsOf(
        await gabriele.query(api.registro.list, {
          day,
          operatoreId: marco._id,
        }),
      ),
    ).toEqual(["ritiro", "cliente_creato"]);
    expect(
      kindsOf(
        await gabriele.query(api.registro.list, { day, operatoreId: rosa._id }),
      ),
    ).toEqual(["cliente_modificato", "cliente_creato"]);
  });

  test("by both at once leaves what one of them did to the other", async () => {
    const t = startApp();
    const { gabriele, giuseppe } = await aMorning(t);

    const day = today();
    const { operatori } = await gabriele.query(api.registro.filterOptions, {
      day,
    });
    const rosa = operatori.find((one) => one.name === "Rosa");
    if (rosa === undefined) {
      throw new Error("The morning's Operatori are not in the filters.");
    }

    expect(
      kindsOf(
        await gabriele.query(api.registro.list, {
          day,
          clienteId: giuseppe,
          operatoreId: rosa._id,
        }),
      ),
    ).toEqual(["cliente_modificato"]);
  });

  test("the filters offer everybody the day saw, by name", async () => {
    const t = startApp();
    const { gabriele } = await aMorning(t);

    expect(
      await gabriele.query(api.registro.filterOptions, { day: today() }),
    ).toEqual({
      clienti: [
        { _id: expect.any(String), name: "Giuseppe Amato", alias: [] },
        { _id: expect.any(String), name: "Salvatore Russo", alias: [] },
      ],
      operatori: [
        { _id: expect.any(String), name: "Gabriele" },
        { _id: expect.any(String), name: "Marco" },
        { _id: expect.any(String), name: "Rosa" },
      ],
    });
  });
});

describe("a day at the mill", () => {
  const hoursIn = (day: string) => {
    const { from, to } = dayBounds(day);
    return (to - from) / (60 * 60 * 1000);
  };

  test("starts at midnight there, wherever the device reading it is", () => {
    // Rome keeps UTC+1 in November: the mill's day starts an hour before the
    // date does at Greenwich, and does so for a device in any timezone.
    expect(new Date(dayBounds("2026-11-12").from).toISOString()).toBe(
      "2026-11-11T23:00:00.000Z",
    );
    expect(hoursIn("2026-11-12")).toBe(24);
  });

  test("is 23 or 25 hours long the two nights the clocks change", () => {
    expect(hoursIn("2026-10-25")).toBe(25);
    expect(hoursIn("2026-03-29")).toBe(23);
  });
});

describe("who the Registro is for", () => {
  test("an Operatore who is not an Admin is refused it, and so is a stranger", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t, "Marco", "auth|marco");

    const day = today();
    await expect(marco.query(api.registro.list, { day })).rejects.toThrow();
    await expect(
      marco.query(api.registro.filterOptions, { day }),
    ).rejects.toThrow();
    await expect(t.query(api.registro.list, { day })).rejects.toThrow();
    await expect(
      t.query(api.registro.filterOptions, { day }),
    ).rejects.toThrow();
  });

  test("signing in, reading and a refused call write nothing", async () => {
    const t = startApp();
    // Signing in is the seed script's Admin and an invited Operatore arriving:
    // an account exists, and the Registro has seen nothing.
    const gabriele = await admin(t);
    const marco = await operatore(t, "Marco", "auth|marco");

    await marco.query(api.clienti.search, {
      term: "",
      paginationOpts: { numItems: 20, cursor: null },
    });
    await marco.query(api.ceste.list, {});
    await marco.query(api.ceste.disponibiliByPortata, {});
    await gabriele.query(api.registro.list, { day: today() });

    // A Censimento is an Admin's, and a Ritiro of no Cesta is no Ritiro.
    await expect(
      marco.mutation(api.ceste.censimento, {
        portata: 400,
        forma: "rettangolare",
        count: 4,
      }),
    ).rejects.toThrow();
    const { _id: clienteId } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await expect(
      marco.mutation(api.movimenti.ritiro, { clienteId, cesteIds: [] }),
    ).rejects.toThrow();
    // A namesake nothing tells apart is refused too.
    await expect(
      marco.mutation(api.clienti.create, { name: "giuseppe  amato" }),
    ).rejects.toThrow();

    // The one Cliente that was actually created, and nothing else.
    expect(kindsOf(await gabriele.query(api.registro.list, {}))).toEqual([
      "cliente_creato",
    ]);
  });
});

// "Rows are never edited or deleted" is kept by there being no mutation that
// could (ADR-0004): the module exports the two reads and the helper the other
// mutations write their row with, and nothing that takes a row's id. There is
// no call to make, and so no test to write — the seam this suite uses is the
// public Convex functions, and a row is beyond every one of them.
