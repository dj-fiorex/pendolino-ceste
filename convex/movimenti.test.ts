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

/** The Cesta the camera has just read off an Etichetta, as the screen adds her. */
const scanCodice = async (device: Device, codice: string) => {
  const cesta = await device.query(api.ceste.byCodice, { codice });
  if (cesta === null) {
    throw new Error(`No Cesta answers to the Codice ${codice}.`);
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
      producedRettifica: false,
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
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
      smsOptOut: false,
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

describe("the signature and the photo of a Ritiro", () => {
  /**
   * A signature or a photograph already in the mill's file storage, and the id
   * the Ritiro then carries.
   *
   * The device gets there in two steps: `media.uploadUrl` says where to put
   * the file — which is its own test below — and the browser POSTs it to
   * Convex's own storage endpoint. That POST reaches no function of this app,
   * so there is nothing of ours for a test to drive it through; this stands in
   * for the browser on that one step, and everything on either side of it goes
   * through the seam.
   */
  const alreadyInStorage = (t: TestConvex<typeof schema>, file: Blob) =>
    t.run((ctx) => ctx.storage.store(file));

  /** The Cliente's finger on the phone, as the small PNG it is drawn into. */
  const aSignature = () =>
    new Blob(["the Cliente's finger"], { type: "image/png" });

  /** The loaded trailer, as the JPEG the device downscaled it to. */
  const aPhotoOfTheLoad = () =>
    new Blob(["the loaded trailer"], { type: "image/jpeg" });

  test("a Ritiro goes through with neither, and nothing hangs off it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [first] = await takeAway(marco, clienteId, ["1", "2"]);

    const history = await marco.query(api.movimenti.byCesta, {
      cestaId: first,
    });
    expect(history).toMatchObject([
      { kind: "ritiro", media: { signature: null, photo: null } },
    ]);
  });

  test("the Cliente signs, and his signature is still there to look at", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cestaId = await typeNumero(marco, "1");

    const signatureId = await alreadyInStorage(t, aSignature());
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [cestaId],
      signatureId,
    });

    const [ritiro] = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(ritiro.kind).toBe("ritiro");
    expect(ritiro.media.signature).toEqual(expect.any(String));
    expect(ritiro.media.photo).toBeNull();
  });

  test("six Ceste are one signature and one photograph, and each of the six shows that pair", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    const signatureId = await alreadyInStorage(t, aSignature());
    const photoId = await alreadyInStorage(t, aPhotoOfTheLoad());
    const cesteIds = [];
    for (const numero of ["1", "2", "3", "4", "5", "6"]) {
      cesteIds.push(await typeNumero(marco, numero));
    }
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds,
      signatureId,
      photoId,
    });

    const eachCesta = [];
    for (const cestaId of cesteIds) {
      const history = await marco.query(api.movimenti.byCesta, { cestaId });
      expect(history).toHaveLength(1);
      eachCesta.push(history[0].media);
    }
    const [onTheFirst] = eachCesta;
    expect(onTheFirst.signature).toEqual(expect.any(String));
    expect(onTheFirst.photo).toEqual(expect.any(String));
    expect(onTheFirst.signature).not.toEqual(onTheFirst.photo);
    // The one pair the Cliente left, wherever the mill goes looking for it.
    expect(eachCesta).toEqual(cesteIds.map(() => onTheFirst));
  });

  test("the pair hangs on the Ritiro, and not on the Rettifica beside it or on a Rientro", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const turiddu = await marco.mutation(api.clienti.create, {
      name: "Salvatore Turiddu",
    });
    // The app has her Fuori with Giuseppe, and Turiddu is loading her: she
    // goes out all the same, with a Rettifica beside her (ADR-0005).
    const cestaId = (await takeAway(marco, giuseppe, ["1"]))[0];

    const signatureId = await alreadyInStorage(t, aSignature());
    const photoId = await alreadyInStorage(t, aPhotoOfTheLoad());
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: turiddu,
      cesteIds: [cestaId],
      signatureId,
      photoId,
    });
    await marco.mutation(api.movimenti.rientro, {
      clienteId: turiddu,
      cesteIds: [cestaId],
    });

    const history = await marco.query(api.movimenti.byCesta, { cestaId });
    // Newest first: the Rientro, then Turiddu's Ritiro and the Rettifica that
    // shares its Registro row, then Giuseppe's Ritiro.
    expect(
      history.map((movimento) => [
        movimento.kind,
        movimento.media.signature !== null,
      ]),
    ).toEqual([
      ["rientro", false],
      ["ritiro", true],
      ["rettifica", false],
      ["ritiro", false],
    ]);
  });

  test("the Registro shows the pair on the one row that is the whole Ritiro", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    const signatureId = await alreadyInStorage(t, aSignature());
    const photoId = await alreadyInStorage(t, aPhotoOfTheLoad());
    const cesteIds = [];
    for (const numero of ["1", "2", "3", "4", "5", "6"]) {
      cesteIds.push(await typeNumero(gabriele, numero));
    }
    await gabriele.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds,
      signatureId,
      photoId,
    });
    // And a Rientro of the same load, which nobody signs for.
    await gabriele.mutation(api.movimenti.rientro, { clienteId, cesteIds });

    const rows = await gabriele.query(api.registro.list, {});
    // Six Ceste out and six back are two rows, not twelve (ADR-0006), and the
    // signature is on the one of them that was signed for.
    expect(
      rows.map((row) => [
        row.action.kind,
        row.media.signature !== null,
        row.media.photo !== null,
      ]),
    ).toEqual([
      ["rientro", false, false],
      ["ritiro", true, true],
      ["cliente_creato", false, false],
      ["censimento", false, false],
    ]);
  });

  test("nobody signed in is given anywhere to put a signature or a photograph", async () => {
    const t = startApp();
    await admin(t);
    const marco = await operatore(t);

    await expect(t.mutation(api.media.uploadUrl, {})).rejects.toThrow();
    expect(await marco.mutation(api.media.uploadUrl, {})).toEqual(
      expect.any(String),
    );
  });
});

describe("a Cesta read by camera or by eye", () => {
  test("the Codice the QR carries and the numero typed find the same Cesta", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);

    const scanned = await gabriele.query(api.ceste.byCodice, {
      codice: "400-R-007",
    });

    expect(scanned).toEqual({
      _id: expect.any(String),
      numero: 7,
      codice: "400-R-007",
      portata: 400,
      state: "disponibile",
      cliente: null,
    });
    expect(scanned).toEqual(
      await gabriele.query(api.ceste.byNumero, { numero: "7" }),
    );
  });

  test("the two readings stay one Cesta wherever she goes", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    // The camera and the keyboard, asked the same question about Cesta 4: the
    // Codice off her QR, her numero, and her numero with the zeros her
    // Etichetta prints. One Cesta, and one answer.
    const bothReadings = async () => {
      const scanned = await marco.query(api.ceste.byCodice, {
        codice: "400-R-004",
      });
      expect(scanned).toEqual(
        await marco.query(api.ceste.byNumero, { numero: "4" }),
      );
      expect(scanned).toEqual(
        await marco.query(api.ceste.byNumero, { numero: "004" }),
      );
      return scanned;
    };

    expect(await bothReadings()).toMatchObject({
      state: "disponibile",
      cliente: null,
    });

    const cestaId = await typeNumero(marco, "4");
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [cestaId],
    });
    expect(await bothReadings()).toMatchObject({
      state: "fuori",
      cliente: { name: "Giuseppe Amato", alias: ["Turi"] },
    });

    await marco.mutation(api.movimenti.rientro, {
      clienteId,
      cesteIds: [cestaId],
    });
    expect(await bothReadings()).toMatchObject({
      state: "attesa_molitura",
      cliente: null,
    });

    // Written off, and still the same Cesta to both: a screen that says what
    // she is beats one pretending she never was (ADR-0005).
    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "rotta",
    });
    expect(await bothReadings()).toMatchObject({
      state: "dismessa",
      cliente: null,
    });
  });

  test("the same Cesta scanned and then typed is one Cesta, and one Movimento", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    // Read off the label, and then typed because the Operatore did not trust
    // the beep. The Ritiro is of one Cesta all the same (#23).
    const scanned = await scanCodice(marco, "400-R-003");
    const typed = await typeNumero(marco, "003");
    expect(scanned).toBe(typed);

    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [scanned, typed],
    });

    const movimenti = await marco.query(api.movimenti.byCliente, { clienteId });
    expect(movimenti).toHaveLength(1);
    expect(movimenti[0]).toMatchObject({ kind: "ritiro", codice: "400-R-003" });
  });

  test("a Codice no Cesta answers to is reported, and nothing is added", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);

    // A Codice this mill never printed: Cesta 7 is rettangolare, and the Q one
    // is somebody else's label rather than hers read loosely (ADR-0007).
    expect(
      await gabriele.query(api.ceste.byCodice, { codice: "400-Q-007" }),
    ).toBeNull();
    expect(
      await gabriele.query(api.ceste.byCodice, { codice: "400-R-999" }),
    ).toBeNull();
    // A QR that decoded to something that was never a Codice at all.
    expect(
      await gabriele.query(api.ceste.byCodice, {
        codice: "https://example.com",
      }),
    ).toBeNull();
    expect(await gabriele.query(api.ceste.byCodice, { codice: "" })).toBeNull();
    // The bare numero is what the counter types, never what the QR carries.
    expect(
      await gabriele.query(api.ceste.byCodice, { codice: "7" }),
    ).toBeNull();
  });

  test("nobody signed in reads a Codice", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);

    await expect(
      t.query(api.ceste.byCodice, { codice: "400-R-001" }),
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
        phone: "+393491234567",
        smsOptOut: false,
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
      producedRettifica: false,
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
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
          smsOptOut: false,
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
      producedRettifica: false,
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
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
      _id: expect.any(String),
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
      // A Rettifica carries neither: only a Ritiro is ever signed for (#25).
      media: { signature: null, photo: null },
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
      _id: expect.any(String),
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
      // A Rettifica carries neither: only a Ritiro is ever signed for (#25).
      media: { signature: null, photo: null },
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
      _id: expect.any(String),
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
      // A Rettifica carries neither: only a Ritiro is ever signed for (#25).
      media: { signature: null, photo: null },
    });
    // The Rettifica is an action a person took, and says so in the Registro
    // under the same row the Movimento carries (ADR-0006, #27).
    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: history[0].registroId,
      at: expect.any(Number),
      operatore: "Gabriele",
      cliente: { name: "Giuseppe Amato", alias: [] },
      campagna: null,
      // The row an Admin's own correction leaves is a row that produced a
      // Rettifica, like the counter's discrepanze (#21).
      producedRettifica: true,
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
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

/**
 * What the app does when the yard and its own records disagree: it says so and
 * gets out of the way. A Cesta the app believes belongs to Tizio, being loaded
 * onto Caio's trailer, is the fact the mill has never been able to see, and
 * blocking the movement throws that fact away (ADR-0005, #21).
 */
describe("the counter is never blocked", () => {
  /** The Rettifiche the app wrote itself against a Cesta, newest first. */
  const discrepanze = async (device: Device, cestaId: Id<"ceste">) =>
    (await device.query(api.movimenti.byCesta, { cestaId })).filter(
      (movimento) => movimento.rettifica?.cause === "discrepanza",
    );

  /** The Registro rows that left a Rettifica behind them, as an Admin reads them. */
  const rowsThatCorrectedSomething = async (gabriele: Device) =>
    await gabriele.query(api.registro.list, { producedRettifica: true });

  test("a Cesta the app has Fuori with somebody else goes out anyway, and the Rettifica says whose it believed she was", async () => {
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
    // Gabriele hands her to Giuseppe in the morning; Marco is at the counter
    // when she turns up on Salvatore's trailer.
    const [cestaId] = await takeAway(gabriele, giuseppe, ["3"]);

    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });

    // She goes out with the man who is actually loading her.
    expect(
      await marco.query(api.clienti.get, { clienteId: salvatore }),
    ).toMatchObject({ cesteFuori: [expect.objectContaining({ numero: 3 })] });
    expect(
      await marco.query(api.clienti.get, { clienteId: giuseppe }),
    ).toMatchObject({ cesteFuori: [] });

    const [correction] = await discrepanze(marco, cestaId);
    expect(correction).toEqual({
      _id: expect.any(String),
      kind: "rettifica",
      rettifica: {
        cause: "discrepanza",
        // What the app believed at the time, kept beside what happened.
        believedState: "fuori",
        becomes: "fuori",
      },
      // Named against Giuseppe, so that the correction turns up in the history
      // of the man she stopped being counted against.
      cliente: { name: "Giuseppe Amato", alias: [] },
      // Attributed to whoever was at the counter, not to whoever was wrong.
      operatore: "Marco",
      at: expect.any(Number),
      campagna: null,
      registroId: expect.any(String),
      // A Rettifica carries neither: only a Ritiro is ever signed for (#25).
      media: { signature: null, photo: null },
    });
    // The correction and the Ritiro are one action a person took (ADR-0006).
    const history = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(history[0].kind).toBe("ritiro");
    expect(history[0].registroId).toBe(correction.registroId);
    expect(await rowsThatCorrectedSomething(gabriele)).toEqual([
      expect.objectContaining({
        _id: correction.registroId,
        operatore: "Marco",
        producedRettifica: true,
        action: { kind: "ritiro", numeri: [3] },
      }),
    ]);
  });

  test("a Cesta still in Attesa molitura goes out anyway, with the Rettifica that says she was full", async () => {
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
    // Her tape says Giuseppe and nobody has tipped her out yet.
    const [cestaId] = await bringBack(gabriele, giuseppe, ["5"]);

    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });

    expect(
      await marco.query(api.ceste.byNumero, { numero: "5" }),
    ).toMatchObject({
      state: "fuori",
      cliente: expect.objectContaining({ name: "Salvatore Russo" }),
    });
    // Off the yard list, because she is not in the yard: she left on a trailer.
    expect(await marco.query(api.ceste.attesaMolitura, {})).toEqual([]);
    const [correction] = await discrepanze(marco, cestaId);
    expect(correction).toMatchObject({
      rettifica: {
        cause: "discrepanza",
        believedState: "attesa_molitura",
        becomes: "fuori",
      },
      // The tape in the yard said Giuseppe, and the correction says so too.
      cliente: { name: "Giuseppe Amato", alias: [] },
      operatore: "Marco",
    });
    // The Ritiro and the correction beside it are one action (ADR-0006).
    const [movimento] = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(movimento.kind).toBe("ritiro");
    expect(movimento.registroId).toBe(correction.registroId);
  });

  test("a Cesta comes back from a Cliente who never took her, and comes to rest under the Cliente present", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const salvatore = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    // Nobody registered her Ritiro, and here she is, full, on the weighbridge.
    const cestaId = await typeNumero(marco, "7");

    await marco.mutation(api.movimenti.rientro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });

    // The paper tape in the yard will carry Salvatore's name, and so does she.
    expect(await marco.query(api.ceste.attesaMolitura, {})).toEqual([
      expect.objectContaining({
        numero: 7,
        cliente: expect.objectContaining({ name: "Salvatore Russo" }),
      }),
    ]);
    const [correction] = await discrepanze(marco, cestaId);
    expect(correction).toMatchObject({
      rettifica: {
        cause: "discrepanza",
        believedState: "disponibile",
        becomes: "attesa_molitura",
      },
      // The app believed nobody had her, so the correction names nobody.
      cliente: null,
      operatore: "Marco",
    });
    const [movimento] = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(movimento.kind).toBe("rientro");
    expect(movimento.registroId).toBe(correction.registroId);
    expect(await rowsThatCorrectedSomething(gabriele)).toEqual([
      expect.objectContaining({
        _id: correction.registroId,
        producedRettifica: true,
        action: { kind: "rientro", numeri: [7] },
      }),
    ]);
  });

  test("a Cesta the app had with somebody else comes back under the Cliente present, with the Rettifica beside her", async () => {
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
    const [cestaId] = await takeAway(gabriele, giuseppe, ["2"]);

    await marco.mutation(api.movimenti.rientro, {
      clienteId: salvatore,
      cesteIds: [cestaId],
    });

    expect(
      await marco.query(api.ceste.attesaMolituraByCliente, {}),
    ).toMatchObject([
      {
        cliente: expect.objectContaining({ name: "Salvatore Russo" }),
        ceste: [expect.objectContaining({ numero: 2 })],
      },
    ]);
    // And she stops being counted against the man the app had her with.
    expect(
      await marco.query(api.clienti.get, { clienteId: giuseppe }),
    ).toMatchObject({ cesteFuori: [] });
    const [correction] = await discrepanze(marco, cestaId);
    expect(correction).toMatchObject({
      rettifica: {
        cause: "discrepanza",
        believedState: "fuori",
        becomes: "attesa_molitura",
      },
      cliente: { name: "Giuseppe Amato", alias: [] },
      operatore: "Marco",
    });
    const [movimento] = await marco.query(api.movimenti.byCesta, { cestaId });
    expect(movimento.kind).toBe("rientro");
    expect(movimento.registroId).toBe(correction.registroId);
  });

  test("a Svuotamento of Ceste the app did not have waiting is one Registro row, flagged", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    // Three in the yard as the app has them, one still Fuori because nobody
    // registered her Rientro, and one it believes is empty on the shelf.
    const waiting = await bringBack(gabriele, giuseppe, ["1", "2", "3"]);
    const [stillOut] = await takeAway(gabriele, giuseppe, ["4"]);
    const onTheShelf = await typeNumero(marco, "8");

    await marco.mutation(api.movimenti.svuotamento, {
      cesteIds: [...waiting, stillOut, onTheShelf],
    });

    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 10 },
      { portata: 250, count: 0 },
    ]);
    expect(await discrepanze(marco, stillOut)).toEqual([
      expect.objectContaining({
        rettifica: {
          cause: "discrepanza",
          believedState: "fuori",
          becomes: "disponibile",
        },
      }),
    ]);
    expect(await discrepanze(marco, onTheShelf)).toEqual([
      expect.objectContaining({
        rettifica: {
          cause: "discrepanza",
          believedState: "disponibile",
          becomes: "disponibile",
        },
      }),
    ]);
    // The three the app had right left nothing behind them.
    for (const cestaId of waiting) {
      expect(await discrepanze(marco, cestaId)).toEqual([]);
    }
    // Five Ceste, two corrections, one action (ADR-0006).
    const [correction] = await discrepanze(marco, stillOut);
    const [otherCorrection] = await discrepanze(marco, onTheShelf);
    expect(otherCorrection.registroId).toBe(correction.registroId);
    const [movimento] = await marco.query(api.movimenti.byCesta, {
      cestaId: stillOut,
    });
    expect(movimento.kind).toBe("svuotamento");
    expect(movimento.registroId).toBe(correction.registroId);
    expect(await rowsThatCorrectedSomething(gabriele)).toEqual([
      expect.objectContaining({
        _id: correction.registroId,
        producedRettifica: true,
        action: { kind: "svuotamento", numeri: [1, 2, 3, 4, 8] },
      }),
    ]);
  });

  test("a Ritiro of six with two surprises is one Registro row, and the Registro reads back the rows like it", async () => {
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
    // One of the six is out with Giuseppe and one is standing full in the yard.
    const [fuori] = await takeAway(gabriele, giuseppe, ["2"]);
    const [full] = await bringBack(gabriele, giuseppe, ["5"]);
    const cesteIds = [];
    for (const numero of ["1", "2", "3", "4", "5", "6"]) {
      cesteIds.push(await typeNumero(marco, numero));
    }

    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds,
    });

    // Six Movimenti, two Rettifiche, and every one of the eight under the one
    // row that says what Marco did (ADR-0006).
    const [correction] = await discrepanze(marco, fuori);
    const [otherCorrection] = await discrepanze(marco, full);
    expect(otherCorrection.registroId).toBe(correction.registroId);
    for (const cestaId of cesteIds) {
      const [movimento] = await marco.query(api.movimenti.byCesta, { cestaId });
      expect(movimento.kind).toBe("ritiro");
      expect(movimento.registroId).toBe(correction.registroId);
    }
    // And the row can be read for as one that produced a Rettifica, which is
    // how the Registro screen offers the day's discrepanze on their own (#27).
    expect(await rowsThatCorrectedSomething(gabriele)).toEqual([
      expect.objectContaining({
        _id: correction.registroId,
        operatore: "Marco",
        cliente: { name: "Salvatore Russo", alias: [] },
        producedRettifica: true,
        action: { kind: "ritiro", numeri: [1, 2, 3, 4, 5, 6] },
      }),
    ]);
    // The whole day still holds three Ritiri, one of them this one, and the
    // same read the other way leaves this one out.
    const wholeDay = await gabriele.query(api.registro.list, {});
    expect(wholeDay.filter((row) => row.action.kind === "ritiro")).toHaveLength(
      3,
    );
    expect(
      await gabriele.query(api.registro.list, { producedRettifica: false }),
    ).not.toContainEqual(
      expect.objectContaining({ _id: correction.registroId }),
    );
  });

  test("no movement is refused for the state the app has a Cesta in", async () => {
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

    // A Ritiro on a Cesta the app has Fuori with somebody else, and then the
    // same Cesta out twice running with no Rientro between.
    const [twiceOut] = await takeAway(gabriele, giuseppe, ["1"]);
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [twiceOut],
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [twiceOut],
    });
    // A Ritiro on a Cesta standing full in the yard.
    const [full] = await bringBack(gabriele, giuseppe, ["2"]);
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [full],
    });
    // A Rientro from a Cliente the app never gave her to, and a second Rientro
    // on a Cesta it already has waiting in the yard.
    const neverOut = await typeNumero(marco, "3");
    await marco.mutation(api.movimenti.rientro, {
      clienteId: salvatore,
      cesteIds: [neverOut],
    });
    await marco.mutation(api.movimenti.rientro, {
      clienteId: salvatore,
      cesteIds: [neverOut],
    });
    // A Svuotamento of a Cesta the app has out with somebody, and of one it
    // already has empty on the shelf.
    const [out] = await takeAway(gabriele, giuseppe, ["4"]);
    const onTheShelf = await typeNumero(marco, "5");
    await marco.mutation(api.movimenti.svuotamento, {
      cesteIds: [out, onTheShelf],
    });

    // Every one of them went through, and each Cesta is where the last
    // movement left her. The database holds sequences that read as impossible
    // and they are not corruption: they are the mill's actual day (ADR-0005).
    const ceste = await marco.query(api.ceste.list, {});
    const stateOf = (numero: number) =>
      ceste.find((cesta) => cesta.numero === numero)?.state;
    expect(stateOf(1)).toBe("fuori");
    expect(stateOf(2)).toBe("fuori");
    expect(stateOf(3)).toBe("attesa_molitura");
    expect(stateOf(4)).toBe("disponibile");
    expect(stateOf(5)).toBe("disponibile");
    // And nothing was written off along the way: a Rettifica of *discrepanza*
    // records what the app believed, it never retires a Cesta (#20).
    expect(ceste.filter((cesta) => cesta.state === "dismessa")).toEqual([]);
  });
});

/**
 * The correction for a Movimento that should never have been registered as it
 * was: a Cesta scanned that never went on the trailer, a Ritiro attributed to
 * the wrong one of two namesakes, a Svuotamento tapped by mistake. The wrong
 * Movimento stays exactly as written, and an Admin says where the Cesta really
 * is (#28, ADR-0004).
 */
describe("a Rettifica for an Errore di registrazione", () => {
  /** The newest Movimento of a kind against a Cesta, as her page reads it. */
  const lastMovimento = async (
    device: Device,
    cestaId: Id<"ceste">,
    kind: "ritiro" | "rientro" | "svuotamento" | "rettifica",
  ) => {
    const found = (await device.query(api.movimenti.byCesta, { cestaId })).find(
      (movimento) => movimento.kind === kind,
    );
    if (found === undefined) {
      throw new Error(`No ${kind} was ever recorded against this Cesta.`);
    }
    return found;
  };

  test("a Cesta scanned by mistake goes back to Disponibile, and her Ritiro stays as written", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    // He took two and the app says three: the third was scanned off the stack
    // beside the trailer and never left the yard.
    const [, , scannedByMistake] = await takeAway(marco, giuseppe, [
      "4",
      "5",
      "6",
    ]);
    const ritiro = await lastMovimento(gabriele, scannedByMistake, "ritiro");

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId: scannedByMistake,
      cause: "errore",
      corrects: ritiro._id,
      becomes: "disponibile",
      note: "Ne ha caricate due, non tre.",
    });

    // She is on the shelf and counted again, and he is holding the two he
    // actually drove away with.
    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 6)?.state).toBe(
      "disponibile",
    );
    expect(await gabriele.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 8 },
      { portata: 250, count: 0 },
    ]);
    expect(
      (
        await gabriele.query(api.clienti.get, { clienteId: giuseppe })
      )?.cesteFuori.map((cesta) => cesta.numero),
    ).toEqual([4, 5]);

    // The Ritiro is untouched: it still says what Marco registered, and the
    // Rettifica beside it says what was really the case (ADR-0004).
    const history = await gabriele.query(api.movimenti.byCesta, {
      cestaId: scannedByMistake,
    });
    expect(history.map((movimento) => movimento.kind)).toEqual([
      "rettifica",
      "ritiro",
    ]);
    expect(history[1]).toMatchObject({
      _id: ritiro._id,
      cliente: { name: "Giuseppe Amato", alias: [] },
      operatore: "Marco",
      at: ritiro.at,
    });
    // And it reads in Giuseppe's own history too, under his name: "why did
    // Cesta 6 stop being counted against me" is asked of the Cliente she was
    // taken off, and the answer has to be where he is looked up.
    expect(
      await gabriele.query(api.movimenti.byCliente, { clienteId: giuseppe }),
    ).toContainEqual(expect.objectContaining({ kind: "rettifica", numero: 6 }));
    expect(history[0].rettifica).toEqual({
      cause: "errore",
      believedState: "fuori",
      becomes: "disponibile",
      corrects: ritiro._id,
      note: "Ne ha caricate due, non tre.",
    });
  });

  test("a Ritiro written against the wrong namesake is put right, and the days Fuori still count from it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    // Two Giuseppe Amato, told apart at the counter by their Soprannomi.
    const turi = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });
    const ciccio = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Ciccio"],
    });
    // Marco wrote the Ritiro against the wrong one of the two.
    const [cestaId] = await takeAway(marco, turi, ["3"]);
    const ritiro = await lastMovimento(gabriele, cestaId, "ritiro");

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "errore",
      corrects: ritiro._id,
      becomes: "fuori",
      clienteId: ciccio,
      note: "Era Ciccio, non Turi.",
    });

    // She is Ciccio's now, and Turi is holding nothing.
    expect(
      await gabriele.query(api.clienti.get, { clienteId: turi }),
    ).toMatchObject({ cesteFuori: [] });
    const his = await gabriele.query(api.clienti.get, { clienteId: ciccio });
    expect(his?.cesteFuori.map((cesta) => cesta.numero)).toEqual([3]);

    // And she has been Fuori since the Ritiro that took her out of the yard,
    // not since the Rettifica: the correction says whose she is, it does not
    // say she left today, and the days the mill will chase Ciccio for are the
    // days she has actually been gone (#22).
    const rettifica = await lastMovimento(gabriele, cestaId, "rettifica");
    expect(rettifica.at).toBeGreaterThan(ritiro.at);
    expect(his?.cesteFuori[0].since).toBe(ritiro.at);
  });

  test("a Svuotamento tapped by mistake puts her back in the yard, under the name on her tape", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    // She came back full with his name on her tape, and then the tile beside
    // hers was tapped with a dirty hand.
    const [cestaId] = await bringBack(marco, giuseppe, ["7"]);
    await marco.mutation(api.movimenti.svuotamento, { cesteIds: [cestaId] });
    const svuotamento = await lastMovimento(gabriele, cestaId, "svuotamento");

    await gabriele.mutation(api.movimenti.rettifica, {
      cestaId,
      cause: "errore",
      corrects: svuotamento._id,
      becomes: "attesa_molitura",
      note: "Era ancora piena.",
    });

    // She is standing full in the yard again, in his group on the Svuotamento
    // screen, because the tape never came off her (#18).
    expect(
      (await marco.query(api.ceste.attesaMolitura, {})).map((cesta) => [
        cesta.numero,
        cesta.cliente?.name,
      ]),
    ).toEqual([[7, "Giuseppe Amato"]]);
    const groups = await marco.query(api.ceste.attesaMolituraByCliente, {});
    expect(groups).toHaveLength(1);
    expect(groups[0].cliente?.name).toBe("Giuseppe Amato");
    expect(groups[0].ceste.map((cesta) => cesta.numero)).toEqual([7]);

    // And she is off the shelf: a count that still had her Disponibile would
    // promise the next Cliente a Cesta full of somebody else's olives.
    expect(await marco.query(api.ceste.disponibiliByPortata, {})).toEqual([
      { portata: 400, count: 9 },
      { portata: 250, count: 0 },
    ]);
    // She is not Fuori and nobody is chased for her: the tape is not a debt.
    expect(
      await gabriele.query(api.clienti.get, { clienteId: giuseppe }),
    ).toMatchObject({ cesteFuori: [] });
  });

  test("a correction that leaves her Fuori names the Cliente, and one that does not names nobody", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const giuseppe = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await takeAway(gabriele, giuseppe, ["8"]);
    const ritiro = await lastMovimento(gabriele, cestaId, "ritiro");
    const correction = {
      cestaId,
      cause: "errore",
      corrects: ritiro._id,
    } as const;

    // Fuori with nobody is not a place a Cesta can be: a Cesta is Fuori
    // because somebody has her, and that is the whole of what Fuori means.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        ...correction,
        becomes: "fuori",
      }),
    ).rejects.toThrow();
    // And a Cesta at the mill is in nobody's hands.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        ...correction,
        becomes: "disponibile",
        clienteId: giuseppe,
      }),
    ).rejects.toThrow();
    // A Cesta leaves the fleet because she is lost or because she is broken.
    // A correction of a Movimento is neither (ADR-0004).
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        ...correction,
        becomes: "dismessa",
      }),
    ).rejects.toThrow();
    // And no other cause says where she is, because each of them says it by
    // being what it is.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId,
        cause: "rotta",
        becomes: "disponibile",
      }),
    ).rejects.toThrow();

    // Nothing of the refusals was written: she is still Fuori with Giuseppe,
    // and the Ritiro is still her only Movimento.
    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 8)?.state).toBe("fuori");
    expect(
      (await gabriele.query(api.movimenti.byCesta, { cestaId })).map(
        (movimento) => movimento.kind,
      ),
    ).toEqual(["ritiro"]);
  });

  test("a correction names one of this Cesta's own movements, and never a Rettifica", async () => {
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
    const [cestaId] = await takeAway(marco, giuseppe, ["1"]);
    const ritiro = await lastMovimento(marco, cestaId, "ritiro");
    // Another Cesta, and a Rettifica the app wrote itself when she went out on
    // the wrong trailer (#21).
    const [hers] = await takeAway(marco, giuseppe, ["2"]);
    await marco.mutation(api.movimenti.ritiro, {
      clienteId: salvatore,
      cesteIds: [hers],
    });
    const discrepanza = await lastMovimento(marco, hers, "rettifica");
    const hersRitiro = await lastMovimento(marco, hers, "ritiro");

    // A correction with no Movimento to correct has nothing to correct.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId,
        cause: "errore",
        becomes: "disponibile",
      }),
    ).rejects.toThrow();
    // Another Cesta's Ritiro is not this Cesta's mistake.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId,
        cause: "errore",
        corrects: hersRitiro._id,
        becomes: "disponibile",
      }),
    ).rejects.toThrow();
    // And a Rettifica is not corrected. It does not say a Cesta moved, it says
    // where she is, and an Admin who reads it wrong records another one about
    // the Cesta rather than about a record of a movement.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId: hers,
        cause: "errore",
        corrects: discrepanza._id,
        becomes: "disponibile",
      }),
    ).rejects.toThrow();
    // Nor does any other cause name a Movimento: only a misregistration is
    // about one.
    await expect(
      gabriele.mutation(api.movimenti.rettifica, {
        cestaId,
        cause: "persa",
        corrects: ritiro._id,
      }),
    ).rejects.toThrow();

    // Both Ceste are where the counter left them, with nothing written over.
    const ceste = await gabriele.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 1)?.state).toBe("fuori");
    expect(ceste.find((cesta) => cesta.numero === 2)?.state).toBe("fuori");
    expect(
      (await gabriele.query(api.movimenti.byCesta, { cestaId })).map(
        (movimento) => movimento.kind,
      ),
    ).toEqual(["ritiro"]);
  });

  test("the counter cannot correct a registration: a Rettifica is an Admin's", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const giuseppe = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const [cestaId] = await takeAway(marco, giuseppe, ["9"]);
    const ritiro = await lastMovimento(marco, cestaId, "ritiro");
    const correction = {
      cestaId,
      cause: "errore",
      corrects: ritiro._id,
      becomes: "disponibile",
    } as const;

    // Whoever made the mistake is not who puts it right: the Operatore who
    // scanned her cannot unscan her, and a stranger cannot either.
    await expect(
      marco.mutation(api.movimenti.rettifica, correction),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.movimenti.rettifica, correction),
    ).rejects.toThrow();

    const ceste = await marco.query(api.ceste.list, {});
    expect(ceste.find((cesta) => cesta.numero === 9)?.state).toBe("fuori");
    expect(
      (await marco.query(api.movimenti.byCesta, { cestaId })).map(
        (movimento) => movimento.kind,
      ),
    ).toEqual(["ritiro"]);
  });
});
