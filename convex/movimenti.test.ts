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
