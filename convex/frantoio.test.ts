/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses. The screen that types these in is not tested here.
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

const FRANTOIO = {
  millName: "Frantoio Pendolino",
  millPhone: "0931 000 000",
  smsSender: "Pendolino",
} as const;

/** What the mill says about itself before an Admin has said anything. */
const SAYS_NOTHING = {
  millName: "",
  millPhone: "",
  smsSender: "",
  sogliaRitardo: 10,
};

describe("what the frantoio says about itself", () => {
  test("says nothing before an Admin has been here", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    expect(await gabriele.query(api.frantoio.settings, {})).toEqual(
      SAYS_NOTHING,
    );
    expect(await gabriele.query(api.registro.list, {})).toEqual([]);
  });

  test("reads back as the Admin set it, in one Registro row", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.frantoio.setSettings, FRANTOIO);

    expect(await gabriele.query(api.frantoio.settings, {})).toEqual({
      ...FRANTOIO,
      sogliaRitardo: 10,
    });
    const [row] = await gabriele.query(api.registro.list, {});
    expect(row.action).toEqual({
      kind: "frantoio_settings",
      changes: [
        { field: "millName", before: "", after: "Frantoio Pendolino" },
        { field: "millPhone", before: "", after: "0931 000 000" },
        { field: "smsSender", before: "", after: "Pendolino" },
      ],
    });
  });

  test("a later change names only what changed", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.frantoio.setSettings, FRANTOIO);

    await gabriele.mutation(api.frantoio.setSettings, {
      ...FRANTOIO,
      millPhone: "0931 111 111",
    });

    const registro = await gabriele.query(api.registro.list, {});
    expect(registro).toHaveLength(2);
    expect(registro[0].action).toEqual({
      kind: "frantoio_settings",
      changes: [
        { field: "millPhone", before: "0931 000 000", after: "0931 111 111" },
      ],
    });
  });

  test("saving the same thing again records nothing, spaces and all", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.frantoio.setSettings, FRANTOIO);

    await gabriele.mutation(api.frantoio.setSettings, FRANTOIO);
    await gabriele.mutation(api.frantoio.setSettings, {
      ...FRANTOIO,
      millName: "  Frantoio Pendolino  ",
    });

    expect(await gabriele.query(api.registro.list, {})).toHaveLength(1);
  });

  test("a name longer than an Etichetta is refused", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.frantoio.setSettings, {
        ...FRANTOIO,
        millName: "Frantoio Oleario Pendolino dei Fratelli Rossi e Figli",
      }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.frantoio.settings, {})).toEqual(
      SAYS_NOTHING,
    );
  });

  test("is an Admin's, to read as much as to change", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.frantoio.setSettings, FRANTOIO);
    const marco = await operatore(t);

    await expect(marco.query(api.frantoio.settings, {})).rejects.toThrow();
    await expect(t.query(api.frantoio.settings, {})).rejects.toThrow();
    await expect(
      marco.mutation(api.frantoio.setSettings, {
        ...FRANTOIO,
        millName: "Frantoio di Marco",
      }),
    ).rejects.toThrow();
    await expect(
      marco.mutation(api.frantoio.setSogliaRitardo, { days: 30 }),
    ).rejects.toThrow();
  });
});

describe("the frantoio's own telephone", () => {
  // Unlike a Cliente's, which is refused where it is typed and stored as E.164
  // (ADR-0009). This one is printed and texted, never dialled by the app, so
  // the mill's own way of writing it is the right one.
  test("is kept exactly as the mill writes it", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.frantoio.setSettings, {
      ...FRANTOIO,
      millPhone: "0931 / 12 34 56",
    });

    expect(
      (await gabriele.query(api.frantoio.settings, {})).millPhone,
    ).toBe("0931 / 12 34 56");
  });

  test("is taken even when the app cannot make sense of it", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    // The screen says it looks odd; the mutation does not argue. A frantoio
    // knows its own telephone better than a rule for Italian numbering does.
    await gabriele.mutation(api.frantoio.setSettings, {
      ...FRANTOIO,
      millPhone: "chiedi di Gabriele",
    });

    expect(
      (await gabriele.query(api.frantoio.settings, {})).millPhone,
    ).toBe("chiedi di Gabriele");
  });
});

describe("the Mittente the mill's Sms arrive from", () => {
  test.each([
    ["left empty", ""],
    ["nothing but spaces", "   "],
  ])("is unsaid when it is %s, which is how a new mill starts", async (
    _why,
    typed,
  ) => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.frantoio.setSettings, {
      ...FRANTOIO,
      smsSender: typed,
    });

    expect(
      (await gabriele.query(api.frantoio.settings, {})).smsSender,
    ).toBe("");
  });

  test.each([
    ["longer than a carrier takes", "Frantoio Pendolino"],
    ["written with an accent", "Frantòio"],
    ["nothing but digits", "0931000"],
    ["punctuated", "Pendolino!"],
  ])("is refused when it is %s", async (_why, sender) => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.frantoio.setSettings, { ...FRANTOIO, smsSender: sender }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.frantoio.settings, {})).toEqual(
      SAYS_NOTHING,
    );
  });

  test.each([
    ["eleven characters exactly", "Pendolino11", "Pendolino11"],
    ["a letter and a number", "Frantoio 1", "Frantoio 1"],
    // A slip the app puts right on its own, as it does for the name beside it.
    ["padded with a space", " Pendolino ", "Pendolino"],
  ])("is taken when it is %s", async (_why, typed, stored) => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.frantoio.setSettings, {
      ...FRANTOIO,
      smsSender: typed,
    });

    expect(
      (await gabriele.query(api.frantoio.settings, {})).smsSender,
    ).toBe(stored);
  });
});
