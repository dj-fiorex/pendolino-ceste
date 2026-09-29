/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { DEFAULT_SMS_RIENTRO, DEFAULT_SMS_RITIRO } from "./template";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses: no table is read or written directly, and nothing is mocked
// (spec #1). No test posts anything to Twilio — the scheduled send is left
// unrun everywhere except the one describe that proves a deployment in prova
// hands nothing over.
const modules = import.meta.glob("./**/*.ts");

const startApp = () => {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
};

const admin = async (t: TestConvex<typeof schema>) => {
  const { authUserId } = await t.action(internal.seed.createFirstAdmin, {
    name: "Gabriele",
    email: "gabriele@frantoio.example",
    password: "olive-di-ottobre",
  });
  return t.withIdentity({ subject: authUserId });
};

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
const aFleetOfTen = async (gabriele: Device) =>
  await gabriele.mutation(api.ceste.censimento, {
    portata: 400,
    forma: "rettangolare",
    count: 10,
  });

/**
 * The mill decides to write to its Clienti, in words a test can read back.
 * Both switches, because a suite that turned on only the one it was about
 * would never notice the other going out by itself.
 */
const millWrites = async (
  gabriele: Device,
  words: Partial<{ ritiro: string; rientro: string }> = {},
) => {
  // A mill with no Mittente cannot turn a switch on, so this is the first
  // thing any mill that means to write to anybody settles. The name and the
  // telephone stay empty, as they are before an Admin has been to Il frantoio:
  // the templates below say nothing about them.
  await millHasASender(gabriele);
  return await gabriele.mutation(api.sms.setSettings, {
    smsRitiroTemplate:
      words.ritiro ?? "Ciao {{nome}}, hai preso {{ceste}}: {{numeri}}.",
    smsRitiroOn: true,
    smsRientroTemplate:
      words.rientro ?? "Grazie {{nome}}. Da riportare: {{totale}}.",
    smsRientroOn: true,
  });
};

/** The mill says who its Sms come from, and nothing else about itself. */
const millHasASender = async (gabriele: Device, sender = "Pendolino") =>
  await gabriele.mutation(api.frantoio.setSettings, {
    millName: "",
    millPhone: "",
    smsSender: sender,
  });

/** The mill's settings as they are before an Admin has touched them. */
const millSaysNothing = {
  smsRitiroTemplate: DEFAULT_SMS_RITIRO,
  smsRitiroOn: false,
  smsRientroTemplate: DEFAULT_SMS_RIENTRO,
  smsRientroOn: false,
};

const typeNumero = async (device: Device, numero: string) => {
  const cesta = await device.query(api.ceste.byNumero, { numero });
  if (cesta === null) {
    throw new Error(`No Cesta answers to the numero ${numero}.`);
  }
  return cesta._id;
};

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

describe("the Sms a Ritiro sends of itself", () => {
  test("six Ceste leaving together are one message, not six", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const marco = await operatore(t);
    const { _id: clienteId } = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await takeAway(marco, clienteId, ["1", "2", "3", "4", "5", "6"]);

    expect(await marco.query(api.sms.byCliente, { clienteId })).toEqual([
      {
        _id: expect.any(String),
        at: expect.any(Number),
        kind: "ritiro",
        body: "Ciao Giuseppe Amato, hai preso 6 ceste: 1, 2, 3, 4, 5, 6.",
        to: "+393471234567",
        // Written and handed to the scheduler. What a carrier makes of it
        // happens outside the transaction, and never at the counter.
        delivery: { kind: "queued", at: expect.any(Number) },
        operatore: "Marco",
      },
    ]);
  });

  test("one Cesta reads as one Cesta, and not as «1 ceste»", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    const [sms] = await gabriele.query(api.sms.byCliente, { clienteId });
    expect(sms.body).toBe("Ciao Giuseppe Amato, hai preso 1 cesta: 1.");
  });

  test("nothing goes out while the mill has not asked for it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    // The two switches start off: a mill trying the app out on a Tuesday does
    // not discover on the Wednesday that it texted two hundred farmers.
    expect(await gabriele.query(api.sms.settings, {})).toEqual(millSaysNothing);
    expect(await gabriele.query(api.sms.byCliente, { clienteId })).toEqual([]);
  });

  test("a Cliente who asked not to be written to gets none, and no row", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    await gabriele.mutation(api.clienti.update, {
      clienteId,
      name: "Giuseppe Amato",
      alias: [],
      phone: "347 1234567",
      smsOptOut: true,
    });

    await takeAway(gabriele, clienteId, ["1"]);

    // Nothing at all: the mill decided this on purpose, and a row a season
    // saying "as instructed, nothing was sent" is noise.
    expect(await gabriele.query(api.sms.byCliente, { clienteId })).toEqual([]);
  });

  test("a Cliente with no telephone leaves the row that says why", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    const [sms] = await gabriele.query(api.sms.byCliente, { clienteId });
    expect(sms).toMatchObject({
      to: null,
      delivery: { kind: "unsendable", reason: "no_phone" },
    });
    // The words are kept even though nobody read them: what the mill needs in
    // November is what it would have said, and to whom it never said it.
    expect(sms.body).toBe("Ciao Giuseppe Amato, hai preso 1 cesta: 1.");
  });

  test("a landline is a good number that no Sms reaches", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "0931 000000",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    expect(
      (await gabriele.query(api.sms.byCliente, { clienteId }))[0],
    ).toMatchObject({
      to: null,
      delivery: { kind: "unsendable", reason: "landline" },
    });
    // And it is still the number the Lista di recupero offers to call.
    const list = await gabriele.query(api.recupero.list, {});
    expect(list.clienti[0].cliente.phone).toBe("+390931000000");
  });
});

describe("the Sms a Rientro sends of itself", () => {
  test("says what he still holds, counted after the load came back", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    const cesteIds = await takeAway(gabriele, clienteId, ["1", "2", "3"]);

    await gabriele.mutation(api.movimenti.rientro, {
      clienteId,
      cesteIds: cesteIds.slice(0, 2),
    });

    const [rientro] = await gabriele.query(api.sms.byCliente, { clienteId });
    expect(rientro.body).toBe("Grazie Giuseppe Amato. Da riportare: 1 cesta.");
  });

  test("the last load back reads «nessuna cesta», not «0 ceste»", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    const cesteIds = await takeAway(gabriele, clienteId, ["1", "2"]);

    await gabriele.mutation(api.movimenti.rientro, { clienteId, cesteIds });

    const [rientro] = await gabriele.query(api.sms.byCliente, { clienteId });
    expect(rientro.body).toBe(
      "Grazie Giuseppe Amato. Da riportare: nessuna cesta.",
    );
  });
});

describe("the words the mill settles", () => {
  test("a placeholder the app cannot fill in is refused, by name", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.sms.setSettings, {
        ...millSaysNothing,
        smsRitiroTemplate: "Gentile {{cognome}}, hai ritirato {{ceste}}.",
      }),
    ).rejects.toThrow(/cognome/);

    // Nothing was written: the mill still says what it said before.
    expect(await gabriele.query(api.sms.settings, {})).toEqual(millSaysNothing);
  });

  test("the change is one Registro row, with the words before and after", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await millHasASender(gabriele);

    await gabriele.mutation(api.sms.setSettings, {
      ...millSaysNothing,
      smsRitiroTemplate: "Ciao {{nome}}.",
      smsRitiroOn: true,
    });

    const [row] = await gabriele.query(api.registro.list, {});
    expect(row.action).toEqual({
      kind: "sms_settings",
      changes: [
        {
          field: "smsRitiroTemplate",
          before: DEFAULT_SMS_RITIRO,
          after: "Ciao {{nome}}.",
        },
        { field: "smsRitiroOn", before: false, after: true },
      ],
    });
  });

  test("saving the same words again records nothing", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await millWrites(gabriele);

    await millWrites(gabriele);

    const rows = await gabriele.query(api.registro.list, {});
    expect(rows.filter((row) => row.action.kind === "sms_settings")).toHaveLength(
      1,
    );
  });

  test("the settings are an Admin's, to read as much as to change", async () => {
    const t = startApp();
    await admin(t);
    const marco = await operatore(t);

    await expect(marco.query(api.sms.settings, {})).rejects.toThrow();
    await expect(
      marco.mutation(api.sms.setSettings, millSaysNothing),
    ).rejects.toThrow();
  });
});

describe("an Admin writing to a Cliente by hand", () => {
  test("is one Sms and one Registro row, carrying what was said", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    await takeAway(gabriele, clienteId, ["1", "2"]);
    await millHasASender(gabriele);

    await gabriele.mutation(api.sms.send, {
      clienteId,
      body: "Gentile {{nome}}, ha ancora {{totale}} da riportare.",
      overrideOptOut: false,
    });

    expect(
      (await gabriele.query(api.sms.byCliente, { clienteId }))[0],
    ).toMatchObject({
      kind: "manuale",
      body: "Gentile Giuseppe Amato, ha ancora 2 ceste da riportare.",
      to: "+393471234567",
    });
    const [row] = await gabriele.query(api.registro.list, {});
    expect(row.action).toEqual({
      kind: "sms_inviato",
      body: "Gentile Giuseppe Amato, ha ancora 2 ceste da riportare.",
      to: "+393471234567",
      overrodeOptOut: false,
    });
  });

  test("is an Admin's: no Operatore writes in the mill's name", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await expect(
      marco.mutation(api.sms.send, {
        clienteId,
        body: "Ciao",
        overrideOptOut: false,
      }),
    ).rejects.toThrow();
    expect(await marco.query(api.sms.byCliente, { clienteId })).toEqual([]);
  });

  test("a Cliente who asked not to be written to needs saying so twice", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    await gabriele.mutation(api.clienti.update, {
      clienteId,
      name: "Giuseppe Amato",
      alias: [],
      phone: "347 1234567",
      smsOptOut: true,
    });
    await millHasASender(gabriele);

    await expect(
      gabriele.mutation(api.sms.send, {
        clienteId,
        body: "Ha ancora le nostre Ceste.",
        overrideOptOut: false,
      }),
    ).rejects.toThrow();

    // Going ahead is allowed and is on the record: the Lista di recupero
    // exists because Ceste go missing.
    await gabriele.mutation(api.sms.send, {
      clienteId,
      body: "Ha ancora le nostre Ceste.",
      overrideOptOut: true,
    });
    const [row] = await gabriele.query(api.registro.list, {});
    expect(row.action).toMatchObject({
      kind: "sms_inviato",
      overrodeOptOut: true,
    });
  });

  test("a Cliente with no telephone is refused, and nothing is written", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await expect(
      gabriele.mutation(api.sms.send, {
        clienteId,
        body: "Ciao",
        overrideOptOut: false,
      }),
    ).rejects.toThrow();

    expect(await gabriele.query(api.sms.byCliente, { clienteId })).toEqual([]);
    // The Cliente being created is the only thing that happened today.
    const registro = await gabriele.query(api.registro.list, {});
    expect(registro.map((row) => row.action.kind)).toEqual(["cliente_creato"]);
  });
});

describe("the Mittente the mill writes as", () => {
  test("holds both switches shut until the mill has one", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.sms.setSettings, {
        smsRitiroTemplate: "Ciao {{nome}}.",
        smsRitiroOn: true,
        smsRientroTemplate: "Grazie {{nome}}.",
        smsRientroOn: false,
      }),
    ).rejects.toThrow(/Mittente/);

    // Nothing was written: the mill still says what it said before.
    expect(await gabriele.query(api.sms.settings, {})).toEqual(millSaysNothing);
  });

  test("lets the words be settled with the switches left off", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await gabriele.mutation(api.sms.setSettings, {
      smsRitiroTemplate: "Ciao {{nome}}.",
      smsRitiroOn: false,
      smsRientroTemplate: "Grazie {{nome}}.",
      smsRientroOn: false,
    });

    expect(
      (await gabriele.query(api.sms.settings, {})).smsRitiroTemplate,
    ).toBe("Ciao {{nome}}.");
  });

  // The bug the first version of this gate had: it refused the switches being
  // on rather than their being turned on, so a mill that cleared its Mittente
  // could not correct a typo in its own words until it switched both off.
  test("does not hold the words hostage once it has been cleared", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await millWrites(gabriele);
    await gabriele.mutation(api.frantoio.setSettings, {
      millName: "",
      millPhone: "",
      smsSender: "",
    });

    await gabriele.mutation(api.sms.setSettings, {
      smsRitiroTemplate: "Ciao {{nome}}, hai preso {{ceste}}.",
      smsRitiroOn: true,
      smsRientroTemplate: "Grazie {{nome}}. Da riportare: {{totale}}.",
      smsRientroOn: true,
    });

    expect(
      (await gabriele.query(api.sms.settings, {})).smsRitiroTemplate,
    ).toBe("Ciao {{nome}}, hai preso {{ceste}}.");
  });

  test("still refuses a switch going on while it is empty", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    // Settled, then cleared, with only the Rientro left on.
    await millWrites(gabriele);
    await gabriele.mutation(api.sms.setSettings, {
      smsRitiroTemplate: "Ciao {{nome}}.",
      smsRitiroOn: false,
      smsRientroTemplate: "Grazie {{nome}}.",
      smsRientroOn: true,
    });
    await gabriele.mutation(api.frantoio.setSettings, {
      millName: "",
      millPhone: "",
      smsSender: "",
    });

    await expect(
      gabriele.mutation(api.sms.setSettings, {
        smsRitiroTemplate: "Ciao {{nome}}.",
        smsRitiroOn: true,
        smsRientroTemplate: "Grazie {{nome}}.",
        smsRientroOn: true,
      }),
    ).rejects.toThrow(/Mittente/);
  });

  test("refuses a message an Admin writes by hand", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await expect(
      gabriele.mutation(api.sms.send, {
        clienteId,
        body: "Ha ancora le nostre Ceste.",
        overrideOptOut: false,
      }),
    ).rejects.toThrow(/Mittente/);
    expect(await gabriele.query(api.sms.byCliente, { clienteId })).toEqual([]);
  });

  // The gap the switches leave open: settle a Mittente, turn them on, then
  // clear it. A receipt going out into that gap says what was actually wrong,
  // rather than blaming a carrier nobody asked (CONTEXT.md, *Sms*).
  test("makes a receipt unsendable rather than failed once it is cleared", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    await gabriele.mutation(api.frantoio.setSettings, {
      millName: "",
      millPhone: "",
      smsSender: "",
    });
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    expect(
      (await gabriele.query(api.sms.byCliente, { clienteId }))[0],
    ).toMatchObject({
      kind: "ritiro",
      // Written down all the same, and with nowhere to send it to.
      to: null,
      delivery: { kind: "unsendable", reason: "no_sender" },
    });
  });

  test("is not what a Cliente's own missing telephone is blamed on", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    expect(
      (await gabriele.query(api.sms.byCliente, { clienteId }))[0],
    ).toMatchObject({
      delivery: { kind: "unsendable", reason: "no_phone" },
    });
  });
});

describe("the Registro", () => {
  test("says of a Ritiro whether it wrote to anybody", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await takeAway(gabriele, clienteId, ["1"]);

    const [ritiro] = await gabriele.query(api.registro.list, {});
    expect(ritiro.sms).toEqual({
      delivery: {
        kind: "unsendable",
        at: expect.any(Number),
        reason: "no_phone",
      },
    });
  });

  test("says nothing of the actions that sent none", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await aFleetOfTen(gabriele);

    const [censimento] = await gabriele.query(api.registro.list, {});
    expect(censimento.sms).toBeNull();
  });
});

describe("what the season has cost", () => {
  test("counts only the messages that actually went out", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    // One with a telephone and one without: the second costs the mill nothing
    // and is not counted as though it had.
    const { _id: giuseppe } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    const { _id: salvatore } = await gabriele.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });
    await takeAway(gabriele, giuseppe, ["1"]);
    await takeAway(gabriele, salvatore, ["2"]);

    const sent = await gabriele.query(api.sms.list, {});
    expect(sent.rows).toHaveLength(2);
    // Neither has left yet: one is queued and the other never will.
    expect(sent).toMatchObject({ count: 0, segments: 0 });
  });

  test("is an Admin's to read", async () => {
    const t = startApp();
    await admin(t);
    const marco = await operatore(t);

    await expect(marco.query(api.sms.list, {})).rejects.toThrow();
  });
});

/**
 * The one part of the Twilio path a test may run. Everywhere else in this
 * suite the scheduled send is left unrun, because running it would post a real
 * message to somebody's telephone; a deployment in prova posts nothing at all,
 * so here the send can be driven to the end and the row read afterwards.
 */
describe("a deployment in prova", () => {
  const sentWith = async (testMode: string | undefined) => {
    // Whatever the machine running the suite happens to have exported: no test
    // posts to Twilio, and none can be made to by an environment.
    vi.stubEnv("TWILIO_ACCOUNT_SID", undefined);
    vi.stubEnv("TWILIO_API_KEY_SID", undefined);
    vi.stubEnv("TWILIO_API_KEY_SECRET", undefined);
    vi.stubEnv("TWILIO_AUTH_TOKEN", undefined);
    vi.stubEnv("TWILIO_TEST_MODE", testMode);
    const t = startApp();
    const gabriele = await admin(t);
    await aFleetOfTen(gabriele);
    await millWrites(gabriele);
    const { _id: clienteId } = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });
    await takeAway(gabriele, clienteId, ["1"]);
    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const [sms] = await gabriele.query(api.sms.byCliente, { clienteId });
    return sms.delivery;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  test("builds the message and hands it to nobody", async () => {
    expect(await sentWith("true")).toEqual({
      kind: "withheld",
      at: expect.any(Number),
    });
  });

  test("a deployment that is not in prova gets as far as needing an account", async () => {
    // No Twilio account is set where the tests run, so the send fails on the
    // credentials and the row says so — which is exactly what the mill would
    // see if somebody deployed without them.
    expect(await sentWith(undefined)).toMatchObject({ kind: "failed" });
  });

  test("neither true nor false is refused rather than guessed at", async () => {
    expect(await sentWith("forse")).toMatchObject({ kind: "failed" });
  });
});
