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

/** The Campagne as the header and the Admin screen read them. */
const campagneOf = async (device: Device) =>
  (await device.query(api.campagne.list, {})).map((campagna) => ({
    name: campagna.name,
    open: campagna.closedAt === null,
  }));

/** One Cesta's own history: what she did, and in which Campagna. */
const historyOf = async (device: Device, numero: string) =>
  (
    await device.query(api.movimenti.byCesta, {
      cestaId: await typeNumero(device, numero),
    })
  ).map((movimento) => ({
    kind: movimento.kind,
    campagna: movimento.campagna,
  }));

/** The whole Registro, newest first, as the kind of action and its Campagna. */
const registroOf = async (gabriele: Device) =>
  (await gabriele.query(api.registro.list, {})).map((row) => ({
    kind: row.action.kind,
    campagna: row.campagna,
  }));

describe("opening a Campagna", () => {
  test("is refused while another one is open, and allowed once it is closed", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    await expect(
      gabriele.mutation(api.campagne.open, { name: "2026" }),
    ).rejects.toThrow();
    expect(await campagneOf(gabriele)).toEqual([{ name: "2025", open: true }]);

    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });
    await gabriele.mutation(api.campagne.open, { name: "2026" });

    expect(await campagneOf(gabriele)).toEqual([
      { name: "2026", open: true },
      { name: "2025", open: false },
    ]);
  });

  test("needs a name, because the counter has to be able to pick one", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.campagne.open, { name: "   " }),
    ).rejects.toThrow();
    expect(await campagneOf(gabriele)).toEqual([]);
  });

  test("is refused a name another Campagna already answers to", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "Raccolto 2025",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });

    // Neither case nor spacing tells two Campagne apart: the counter picks one
    // by her name, and two rows nothing tells apart is the confusion this rule
    // exists to prevent.
    await expect(
      gabriele.mutation(api.campagne.open, { name: "raccolto  2025" }),
    ).rejects.toThrow();

    expect(await campagneOf(gabriele)).toEqual([
      { name: "Raccolto 2025", open: false },
    ]);
  });

  test("is refused to an Operatore who is not an Admin", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);

    await expect(
      marco.mutation(api.campagne.open, { name: "2025" }),
    ).rejects.toThrow();
    expect(await campagneOf(gabriele)).toEqual([]);
  });
});

describe("a Movimento and the Campagna it belongs to", () => {
  test("carries the Campagna that was open when it happened", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    await gabriele.mutation(api.campagne.open, { name: "2025" });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });
    await marco.mutation(api.movimenti.rientro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });
    await marco.mutation(api.movimenti.svuotamento, {
      cesteIds: [await typeNumero(marco, "3")],
    });

    expect(await historyOf(marco, "3")).toEqual([
      { kind: "svuotamento", campagna: "2025" },
      { kind: "rientro", campagna: "2025" },
      { kind: "ritiro", campagna: "2025" },
    ]);
  });

  test("carries the Campagna the device names when none is open, which stays closed", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    // February: the Cliente turns up with a Cesta nobody chased, and the
    // Operatore has said once that their Movimenti belong to the 2025 season.
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
      campagnaId,
    });

    expect(await historyOf(marco, "3")).toEqual([
      { kind: "ritiro", campagna: "2025" },
    ]);
    // Recording against it does not reopen it: only an Admin opens a Campagna.
    expect(await campagneOf(marco)).toEqual([{ name: "2025", open: false }]);
  });

  test("carries the open Campagna, whatever a device still names", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const closed = await gabriele.mutation(api.campagne.open, { name: "2025" });
    await gabriele.mutation(api.campagne.close, {
      campagnaId: closed,
      confirmed: false,
    });
    await gabriele.mutation(api.campagne.open, { name: "2026" });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    // The device still remembers the choice it was asked for in February; the
    // Campagna the mill has since opened is the one that counts.
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
      campagnaId: closed,
    });

    expect(await historyOf(marco, "3")).toEqual([
      { kind: "ritiro", campagna: "2026" },
    ]);
  });

  test("goes through with no Campagna at all: the counter is never blocked", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });

    expect(await historyOf(marco, "3")).toEqual([
      { kind: "ritiro", campagna: null },
    ]);
  });
});

describe("closing a Campagna", () => {
  test("lists the Ceste still Fuori and who holds them, and proceeds on confirmation", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3"), await typeNumero(marco, "5")],
    });

    expect(await gabriele.query(api.ceste.fuoriByCliente, {})).toEqual([
      {
        cliente: {
          _id: clienteId,
          name: "Giuseppe Amato",
          alias: ["Turi"],
          phone: null,
          smsOptOut: false,
        },
        ceste: [
          { numero: 3, codice: "400-R-003" },
          { numero: 5, codice: "400-R-005" },
        ],
      },
    ]);

    await expect(
      gabriele.mutation(api.campagne.close, { campagnaId, confirmed: false }),
    ).rejects.toThrow();
    expect(await campagneOf(gabriele)).toEqual([{ name: "2025", open: true }]);

    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: true,
    });
    expect(await campagneOf(gabriele)).toEqual([{ name: "2025", open: false }]);
  });

  test("changes no Cesta's state: closing is bookkeeping over Movimenti", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });
    await marco.mutation(api.movimenti.rientro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "5")],
    });
    const before = await marco.query(api.ceste.list, {});

    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: true,
    });

    expect(await marco.query(api.ceste.list, {})).toEqual(before);
    // A Cesta at a Cliente's house does not come home because a register was
    // closed, and neither does one waiting to be milled.
    expect(before.map((cesta) => cesta.state)).toEqual([
      "disponibile",
      "disponibile",
      "fuori",
      "disponibile",
      "attesa_molitura",
      "disponibile",
      "disponibile",
      "disponibile",
      "disponibile",
      "disponibile",
    ]);
  });

  test("is refused to an Operatore who is not an Admin", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });

    await expect(
      marco.mutation(api.campagne.close, { campagnaId, confirmed: true }),
    ).rejects.toThrow();
    expect(await campagneOf(gabriele)).toEqual([{ name: "2025", open: true }]);
  });
});

describe("reopening a Campagna", () => {
  test("puts back the one that was closed by mistake", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });

    await gabriele.mutation(api.campagne.reopen, { campagnaId });

    expect(await campagneOf(gabriele)).toEqual([{ name: "2025", open: true }]);
  });

  test("is refused while another Campagna is open", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });
    await gabriele.mutation(api.campagne.open, { name: "2026" });

    await expect(
      gabriele.mutation(api.campagne.reopen, { campagnaId }),
    ).rejects.toThrow();

    expect(await campagneOf(gabriele)).toEqual([
      { name: "2026", open: true },
      { name: "2025", open: false },
    ]);
  });

  test("is refused to an Operatore who is not an Admin", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });

    await expect(
      marco.mutation(api.campagne.reopen, { campagnaId }),
    ).rejects.toThrow();
    expect(await campagneOf(gabriele)).toEqual([{ name: "2025", open: false }]);
  });
});

describe("renaming a Campagna", () => {
  test("is an Admin's, and keeps the Movimenti where they were", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });

    await expect(
      marco.mutation(api.campagne.rename, { campagnaId, name: "2025/2026" }),
    ).rejects.toThrow();
    await gabriele.mutation(api.campagne.rename, {
      campagnaId,
      name: "2025/2026",
    });

    expect(await campagneOf(gabriele)).toEqual([
      { name: "2025/2026", open: true },
    ]);
    expect(await historyOf(marco, "3")).toEqual([
      { kind: "ritiro", campagna: "2025/2026" },
    ]);
  });
});

describe("naming a Campagna", () => {
  test("is refused another Campagna's name, and allowed her own written better", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const closed = await gabriele.mutation(api.campagne.open, {
      name: "Raccolto 2025",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId: closed,
      confirmed: false,
    });
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2026",
    });

    await expect(
      gabriele.mutation(api.campagne.rename, {
        campagnaId,
        name: "raccolto 2025",
      }),
    ).rejects.toThrow();
    // A Campagna is never her own namesake: this is the capital letter the
    // Admin meant the first time.
    await gabriele.mutation(api.campagne.rename, {
      campagnaId: closed,
      name: "raccolto 2025",
    });

    expect(await campagneOf(gabriele)).toEqual([
      { name: "2026", open: true },
      { name: "raccolto 2025", open: false },
    ]);
  });
});

describe("the Registro and the Campagne", () => {
  test("names every Campagna a person opened, renamed, closed and reopened", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    await gabriele.mutation(api.campagne.rename, {
      campagnaId,
      name: "2025/2026",
    });
    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: false,
    });
    await gabriele.mutation(api.campagne.reopen, { campagnaId });

    expect(
      (await gabriele.query(api.registro.list, {})).map((row) => row.action),
    ).toEqual([
      { kind: "campagna_riaperta", name: "2025/2026" },
      { kind: "campagna_chiusa", name: "2025/2026", numeriFuori: [] },
      { kind: "campagna_rinominata", before: "2025", after: "2025/2026" },
      { kind: "campagna_aperta", name: "2025" },
    ]);
  });

  test("says which Ceste were still Fuori when a Campagna was closed", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    const campagnaId = await gabriele.mutation(api.campagne.open, {
      name: "2025",
    });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "5"), await typeNumero(marco, "3")],
    });

    await gabriele.mutation(api.campagne.close, {
      campagnaId,
      confirmed: true,
    });

    expect((await gabriele.query(api.registro.list, {}))[0].action).toEqual({
      kind: "campagna_chiusa",
      name: "2025",
      numeriFuori: [3, 5],
    });
  });

  test("carries on every row the Campagna the action belonged to", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const marco = await operatore(t);
    await gabriele.mutation(api.campagne.open, { name: "2025" });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [await typeNumero(marco, "3")],
    });

    expect(await registroOf(gabriele)).toEqual([
      { kind: "ritiro", campagna: "2025" },
      { kind: "cliente_creato", campagna: "2025" },
      // The Censimento came before the mill opened the season, and no row is
      // rewritten to say otherwise (ADR-0004).
      { kind: "campagna_aperta", campagna: "2025" },
      { kind: "censimento", campagna: null },
    ]);
  });
});
