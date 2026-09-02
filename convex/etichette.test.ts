/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses. The PDF is rendered in the browser, outside that seam, and
// is not tested here (#29).
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

const SETTINGS = {
  etichettaSize: "100x150",
  millName: "Frantoio Pendolino",
  millNameOnEtichetta: true,
  millPhone: "0931 000 000",
  millPhoneOnEtichetta: true,
} as const;

describe("the Etichetta settings", () => {
  test("read as the app's own before an Admin has ever set them", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    expect(await gabriele.query(api.etichette.settings, {})).toEqual({
      etichettaSize: "100x150",
      millName: "",
      millNameOnEtichetta: true,
      millPhone: "",
      millPhoneOnEtichetta: true,
    });
    expect(await gabriele.query(api.registro.list, {})).toEqual([]);
  });

  test("read back as the Admin set them, and the change is in the Registro", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.etichette.setSettings, {
      ...SETTINGS,
      etichettaSize: "70x100",
      millPhoneOnEtichetta: false,
    });

    expect(await gabriele.query(api.etichette.settings, {})).toEqual({
      ...SETTINGS,
      etichettaSize: "70x100",
      millPhoneOnEtichetta: false,
    });
    expect(await gabriele.query(api.registro.list, {})).toEqual([
      {
        operatore: "Gabriele",
        action: {
          kind: "etichette_settings",
          changes: [
            { field: "etichettaSize", before: "100x150", after: "70x100" },
            { field: "millName", before: "", after: "Frantoio Pendolino" },
            { field: "millPhone", before: "", after: "0931 000 000" },
            { field: "millPhoneOnEtichetta", before: true, after: false },
          ],
        },
      },
    ]);
  });

  test("a later change is a Registro row of its own, naming only what changed", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.etichette.setSettings, SETTINGS);

    await gabriele.mutation(api.etichette.setSettings, {
      ...SETTINGS,
      millPhone: "0931 111 111",
    });

    const registro = await gabriele.query(api.registro.list, {});
    expect(registro).toHaveLength(2);
    expect(registro[0].action).toEqual({
      kind: "etichette_settings",
      changes: [
        { field: "millPhone", before: "0931 000 000", after: "0931 111 111" },
      ],
    });
  });

  test("saving the same settings again records nothing", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.etichette.setSettings, SETTINGS);

    await gabriele.mutation(api.etichette.setSettings, SETTINGS);
    await gabriele.mutation(api.etichette.setSettings, {
      ...SETTINGS,
      millName: "  Frantoio Pendolino  ",
    });

    expect(await gabriele.query(api.registro.list, {})).toHaveLength(1);
    expect(await gabriele.query(api.etichette.settings, {})).toEqual(SETTINGS);
  });

  test("a name longer than an Etichetta is refused", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.etichette.setSettings, {
        ...SETTINGS,
        millName: "Frantoio Oleario Pendolino dei Fratelli Rossi e Figli",
      }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.etichette.settings, {})).toEqual({
      ...SETTINGS,
      millName: "",
      millPhone: "",
    });
  });

  test("the settings are an Admin's, to read as much as to change", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.etichette.setSettings, SETTINGS);
    const marco = await operatore(t);

    await expect(marco.query(api.etichette.settings, {})).rejects.toThrow();
    await expect(t.query(api.etichette.settings, {})).rejects.toThrow();
    await expect(
      marco.mutation(api.etichette.setSettings, {
        ...SETTINGS,
        millName: "Frantoio di Marco",
      }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.etichette.settings, {})).toEqual(SETTINGS);
  });
});

// The reprint promise is #29's, though what keeps it is the fleet's: the
// Codice is stored at Censimento and never recomputed (ADR-0007). It is
// asserted here because this is the ticket that made the promise.
describe("reprinting a torn Etichetta", () => {
  test("gives back the Codici of the first print, however the fleet has grown since", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 3,
    });
    const firstPrint = await gabriele.query(api.ceste.list, {});

    await gabriele.mutation(api.ceste.censimento, {
      portata: 250,
      forma: "quadrata",
      count: 4,
    });
    await gabriele.mutation(api.etichette.setSettings, SETTINGS);

    const reprint = (await gabriele.query(api.ceste.list, {})).filter(
      (cesta) => cesta.numero <= 3,
    );
    expect(reprint.map((cesta) => cesta.codice)).toEqual(
      firstPrint.map((cesta) => cesta.codice),
    );
    expect(reprint.map((cesta) => cesta.codice)).toEqual([
      "400-R-001",
      "400-R-002",
      "400-R-003",
    ]);
  });
});
