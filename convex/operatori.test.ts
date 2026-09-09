/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// Every test drives the app through its public Convex functions, the one seam
// this suite uses. Signing in is one of them: Better Auth answers on this app's
// own HTTP routes, so a password is typed here the way a phone at the counter
// types it, and a refusal is the refusal the phone would get.
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

type Device = Awaited<ReturnType<typeof admin>>;

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

/**
 * The link the mill emailed, as the person it was sent to reads it out of
 * their inbox. The message itself goes out through Resend from a scheduled
 * action, which no test runs: everything worth testing is what somebody does
 * with the link once they have it.
 */
const linkIn = async (
  t: TestConvex<typeof schema>,
  accessLinkId: Id<"accessLinks">,
) => {
  const link = await t.query(internal.accessLinks.get, { accessLinkId });
  if (link === null) {
    throw new Error("The mill sent no such link.");
  }
  return link.token;
};

/** Typing an email and a password into the sign-in screen. */
const signIn = async (
  t: TestConvex<typeof schema>,
  email: string,
  password: string,
) =>
  await t.fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

/** The same, on a device that is then held by whoever signed in. */
const signedInOn = async (
  t: TestConvex<typeof schema>,
  email: string,
  password: string,
) => {
  const response = await signIn(t, email, password);
  if (response.status !== 200) {
    throw new Error(`The mill refused ${email}: ${response.status}.`);
  }
  const session: { user: { id: string } } = await response.json();
  return t.withIdentity({ subject: session.user.id });
};

/** Somebody invited, and arriving: the whole of how staff join the mill. */
const joins = async (
  t: TestConvex<typeof schema>,
  invitedBy: Device,
  person: { name: string; email: string; password: string; role?: "admin" },
) => {
  const invitation = await invitedBy.mutation(api.operatori.invite, {
    name: person.name,
    email: person.email,
    role: person.role ?? "operatore",
  });
  await t.action(api.accounts.accept, {
    token: await linkIn(t, invitation),
    password: person.password,
  });
};

/** One of the mill's staff, as the Admin's own screen finds them. */
const staffMember = async (device: Device, name: string) => {
  const staff = await device.query(api.operatori.list, {});
  const found = staff.find((one) => one.name === name);
  if (found === undefined) {
    throw new Error(`Nobody at the mill answers to ${name}.`);
  }
  return found;
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

describe("the Operatore signed in on a device", () => {
  test("nobody is signed in before anybody signs in", async () => {
    const t = startApp();

    expect(await t.query(api.operatori.current, {})).toBeNull();
  });

  test("the seeded first Admin is known by name and by role", async () => {
    const t = startApp();
    const { authUserId } = await t.action(internal.seed.createFirstAdmin, {
      name: "Gabriele",
      email: "gabriele@frantoio.example",
      password: "olive-di-ottobre",
    });

    const operatore = await t
      .withIdentity({ subject: authUserId })
      .query(api.operatori.current, {});

    expect(operatore).toEqual({
      name: "Gabriele",
      email: "gabriele@frantoio.example",
      role: "admin",
    });
  });

  test("the mill gets only one first Admin", async () => {
    const t = startApp();
    const firstAdmin = {
      name: "Gabriele",
      email: "gabriele@frantoio.example",
      password: "olive-di-ottobre",
    };
    await t.action(internal.seed.createFirstAdmin, firstAdmin);

    await expect(
      t.action(internal.seed.createFirstAdmin, {
        ...firstAdmin,
        email: "secondo@frantoio.example",
      }),
    ).rejects.toThrow();
  });
});

describe("an invitation", () => {
  test("brings in an Operatore who chose their own password", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    const invitation = await gabriele.mutation(api.operatori.invite, {
      name: "Nadia Greco",
      // As an Admin types it at the counter: the address is the person's, not
      // the capital letters they happened to use.
      email: " Nadia@Frantoio.example ",
      role: "operatore",
    });
    await t.action(api.accounts.accept, {
      token: await linkIn(t, invitation),
      password: "raccolta-di-novembre",
    });

    const nadia = await signedInOn(
      t,
      "nadia@frantoio.example",
      "raccolta-di-novembre",
    );
    expect(await nadia.query(api.operatori.current, {})).toEqual({
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      role: "operatore",
    });
  });

  test("can be accepted once and no more", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const invitation = await gabriele.mutation(api.operatori.invite, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      role: "operatore",
    });
    const token = await linkIn(t, invitation);
    await t.action(api.accounts.accept, {
      token,
      password: "raccolta-di-novembre",
    });

    await expect(
      t.action(api.accounts.accept, {
        token,
        password: "una-password-qualsiasi",
      }),
    ).rejects.toThrow();
    expect(
      (await gabriele.query(api.operatori.list, {})).map((one) => one.name),
    ).toEqual(["Gabriele", "Nadia Greco"]);
  });

  test("stops opening anything once it has expired", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const invitation = await gabriele.mutation(api.operatori.invite, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      role: "operatore",
    });
    const token = await linkIn(t, invitation);

    // A fortnight later, the Campagna in full swing and the invitation still
    // sitting unopened in an inbox.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await expect(
        t.action(api.accounts.accept, {
          token,
          password: "raccolta-di-novembre",
        }),
      ).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }

    expect(
      (await gabriele.query(api.operatori.list, {})).map((one) => one.name),
    ).toEqual(["Gabriele"]);
  });

  test("is refused at an address one of the mill's people already holds", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.operatori.invite, {
        name: "Gabriele di nuovo",
        email: "gabriele@frantoio.example",
        role: "operatore",
      }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.accessLinks.pending, {})).toEqual([]);
  });

  test("can be sent as an Admin, so that the mill is never down to one", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await joins(t, gabriele, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      password: "raccolta-di-novembre",
      role: "admin",
    });

    const nadia = await signedInOn(
      t,
      "nadia@frantoio.example",
      "raccolta-di-novembre",
    );
    // An Admin's own screen, which the mutations and not the screen refuse to
    // anybody else.
    expect((await nadia.query(api.operatori.list, {})).length).toBe(2);
  });

  test("shows as pending until it is accepted", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const invitation = await gabriele.mutation(api.operatori.invite, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      role: "operatore",
    });

    const waiting = await gabriele.query(api.accessLinks.pending, {});
    expect(
      waiting.map((one) => ({ name: one.name, email: one.email })),
    ).toEqual([{ name: "Nadia Greco", email: "nadia@frantoio.example" }]);

    await t.action(api.accounts.accept, {
      token: await linkIn(t, invitation),
      password: "raccolta-di-novembre",
    });
    expect(await gabriele.query(api.accessLinks.pending, {})).toEqual([]);
  });

  test("is the only way in: nobody signs themselves up", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    const signUp = await t.fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Chiunque",
        email: "chiunque@frantoio.example",
        password: "mi-metto-dentro-da-solo",
      }),
    });

    expect(signUp.status).toBe(400);
    expect(
      (await gabriele.query(api.operatori.list, {})).map((one) => one.name),
    ).toEqual(["Gabriele"]);
  });

  test("leaves a row when it is sent and another when it is accepted", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await joins(t, gabriele, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      password: "raccolta-di-novembre",
    });

    const rows = await gabriele.query(api.registro.list, {});
    expect(kindsOf(rows)).toEqual(["invito_accettato", "operatore_invitato"]);
    // The invitation is the Admin's doing; accepting it is the new Operatore's.
    expect(rows.map((row) => row.operatore)).toEqual([
      "Nadia Greco",
      "Gabriele",
    ]);
    expect(rows[1].action).toEqual({
      kind: "operatore_invitato",
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      role: "operatore",
    });
  });
});

/**
 * The one part of the mail path a test may run. Everywhere else in this suite
 * the scheduled action is left unrun, because running it would post a real
 * message to Resend; a deployment in prova posts nothing at all, so here the
 * send can be driven to the end and the Admin's screen read afterwards.
 */
describe("a deployment in prova", () => {
  /** An Admin invites somebody, and the mail path runs to its end. */
  const invitedWith = async (testMode: string | undefined) => {
    // Whatever the machine running the suite happens to have exported: no
    // test posts to Resend, and none can be made to by an environment.
    vi.stubEnv("RESEND_API_KEY", undefined);
    vi.stubEnv("RESEND_TEST_MODE", testMode);
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.operatori.invite, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      role: "operatore",
    });
    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const [waiting] = await gabriele.query(api.accessLinks.pending, {});
    return waiting.delivery;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  test("keeps the invitation and says nothing was sent", async () => {
    expect(await invitedWith("true")).toEqual({
      kind: "withheld",
      at: expect.any(Number),
    });
  });

  test("sends for real when it is told to, even in lowercase", async () => {
    // No RESEND_API_KEY is set where the tests run, so a deployment that is
    // not in prova gets as far as needing one and no further: the message
    // never reaches Resend, and the Admin is told why.
    expect(await invitedWith("False")).toEqual({
      kind: "failed",
      at: expect.any(Number),
      reason: expect.stringContaining("RESEND_API_KEY"),
    });
  });

  test("refuses a value that is neither true nor false", async () => {
    // Guessing either way is worse than saying so: one posts real mail on a
    // deployment that asked not to, the other swallows an invitation.
    expect(await invitedWith("si")).toEqual({
      kind: "failed",
      at: expect.any(Number),
      reason: expect.stringContaining("RESEND_TEST_MODE"),
    });
  });
});

describe("a password an Operatore has forgotten", () => {
  test("is replaced by one they choose from the link an Admin sends", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await joins(t, gabriele, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      password: "raccolta-di-novembre",
    });
    const nadia = await staffMember(gabriele, "Nadia Greco");

    const reset = await gabriele.mutation(api.operatori.sendPasswordReset, {
      operatoreId: nadia._id,
    });
    await t.action(api.accounts.setPassword, {
      token: await linkIn(t, reset),
      password: "olive-di-dicembre",
    });

    expect(
      (await signIn(t, "nadia@frantoio.example", "raccolta-di-novembre"))
        .status,
    ).toBe(401);
    expect(
      (await signIn(t, "nadia@frantoio.example", "olive-di-dicembre")).status,
    ).toBe(200);
  });

  test("is not reset twice from one link", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await joins(t, gabriele, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      password: "raccolta-di-novembre",
    });
    const nadia = await staffMember(gabriele, "Nadia Greco");
    const reset = await gabriele.mutation(api.operatori.sendPasswordReset, {
      operatoreId: nadia._id,
    });
    const token = await linkIn(t, reset);
    await t.action(api.accounts.setPassword, {
      token,
      password: "olive-di-dicembre",
    });

    await expect(
      t.action(api.accounts.setPassword, {
        token,
        password: "una-password-qualsiasi",
      }),
    ).rejects.toThrow();
    expect(
      (await signIn(t, "nadia@frantoio.example", "olive-di-dicembre")).status,
    ).toBe(200);
  });

  test("is never asked for by the person who forgot it", async () => {
    const t = startApp();
    await admin(t);

    // There is no self-service reset: the staff do not read email in the yard,
    // and the Admin is standing next to them (ADR-0008). Better Auth's own
    // reset route is off, and this is what asking it gets.
    const asked = await t.fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "gabriele@frantoio.example",
        redirectTo: "http://localhost:3000/password",
      }),
    });

    expect(asked.status).toBe(400);
    expect(
      (await signIn(t, "gabriele@frantoio.example", "olive-di-ottobre")).status,
    ).toBe(200);
  });

  test("leaves a row saying the Admin sent the link", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await operatore(t, "Marco", "auth|marco");

    await gabriele.mutation(api.operatori.sendPasswordReset, {
      operatoreId: (await staffMember(gabriele, "Marco"))._id,
    });

    const rows = await gabriele.query(api.registro.list, {});
    expect(rows[0].operatore).toBe("Gabriele");
    expect(rows[0].action).toEqual({
      kind: "operatore_reset_inviato",
      name: "Marco",
      email: "marco@frantoio.example",
    });
  });
});

describe("promoting an Operatore", () => {
  test("makes them an Admin, and says what they were and what they are", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t, "Marco", "auth|marco");

    await gabriele.mutation(api.operatori.promote, {
      operatoreId: (await staffMember(gabriele, "Marco"))._id,
    });

    expect((await staffMember(gabriele, "Marco")).role).toBe("admin");
    // What being an Admin is: the screens an Operatore is refused.
    expect((await marco.query(api.registro.list, {})).length).toBeGreaterThan(
      0,
    );
    const rows = await gabriele.query(api.registro.list, {});
    expect(rows[0].operatore).toBe("Gabriele");
    expect(rows[0].action).toEqual({
      kind: "operatore_promosso",
      name: "Marco",
      before: "operatore",
      after: "admin",
    });
  });

  test("a second time is not a second promotion", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await operatore(t, "Marco", "auth|marco");
    const marco = await staffMember(gabriele, "Marco");
    await gabriele.mutation(api.operatori.promote, { operatoreId: marco._id });

    await gabriele.mutation(api.operatori.promote, { operatoreId: marco._id });

    expect(kindsOf(await gabriele.query(api.registro.list, {}))).toEqual([
      "operatore_promosso",
    ]);
  });
});

describe("deactivating an Operatore", () => {
  test("shuts them out of the sign-in screen and of the device in their pocket", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await joins(t, gabriele, {
      name: "Nadia Greco",
      email: "nadia@frantoio.example",
      password: "raccolta-di-novembre",
    });
    const phone = await signedInOn(
      t,
      "nadia@frantoio.example",
      "raccolta-di-novembre",
    );

    await gabriele.mutation(api.operatori.deactivate, {
      operatoreId: (await staffMember(gabriele, "Nadia Greco"))._id,
    });

    expect(
      (await signIn(t, "nadia@frantoio.example", "raccolta-di-novembre"))
        .status,
    ).toBe(401);
    expect(await phone.query(api.operatori.current, {})).toBeNull();
    await expect(phone.query(api.ceste.list, {})).rejects.toThrow();
  });

  test("leaves their Movimenti readable, still under their name", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 3,
    });
    const marco = await operatore(t, "Marco", "auth|marco");
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: [],
    });
    const cestaId = await typeNumero(marco, "2");
    await marco.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: [cestaId],
    });

    await gabriele.mutation(api.operatori.deactivate, {
      operatoreId: (await staffMember(gabriele, "Marco"))._id,
    });

    const history = await gabriele.query(api.movimenti.byCesta, { cestaId });
    expect(
      history.map((movimento) => ({
        kind: movimento.kind,
        operatore: movimento.operatore,
      })),
    ).toEqual([{ kind: "ritiro", operatore: "Marco" }]);
    const rows = await gabriele.query(api.registro.list, {});
    expect(
      rows
        .filter((row) => row.action.kind === "ritiro")
        .map((row) => row.operatore),
    ).toEqual(["Marco"]);
  });

  test("is refused to an Admin on themselves", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    await expect(
      gabriele.mutation(api.operatori.deactivate, {
        operatoreId: (await staffMember(gabriele, "Gabriele"))._id,
      }),
    ).rejects.toThrow();
    expect((await staffMember(gabriele, "Gabriele")).active).toBe(true);
  });

  test("leaves a row saying who was taken off the counter", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await operatore(t, "Marco", "auth|marco");

    await gabriele.mutation(api.operatori.deactivate, {
      operatoreId: (await staffMember(gabriele, "Marco"))._id,
    });

    const rows = await gabriele.query(api.registro.list, {});
    expect(rows[0].operatore).toBe("Gabriele");
    expect(rows[0].action).toEqual({
      kind: "operatore_disattivato",
      name: "Marco",
    });
  });
});

describe("the staff", () => {
  test("are an Admin's to invite, promote and deactivate, and nobody else's", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t, "Marco", "auth|marco");
    const himself = (await staffMember(gabriele, "Marco"))._id;

    await expect(
      marco.mutation(api.operatori.invite, {
        name: "Nadia Greco",
        email: "nadia@frantoio.example",
        role: "operatore",
      }),
    ).rejects.toThrow();
    await expect(
      marco.mutation(api.operatori.promote, { operatoreId: himself }),
    ).rejects.toThrow();
    await expect(
      marco.mutation(api.operatori.deactivate, { operatoreId: himself }),
    ).rejects.toThrow();
    await expect(
      marco.mutation(api.operatori.sendPasswordReset, { operatoreId: himself }),
    ).rejects.toThrow();
    await expect(marco.query(api.operatori.list, {})).rejects.toThrow();
    await expect(marco.query(api.accessLinks.pending, {})).rejects.toThrow();

    // Nothing of the four went through: no invitation waiting, and Marco is
    // counter staff still.
    expect(await gabriele.query(api.accessLinks.pending, {})).toEqual([]);
    expect(await staffMember(gabriele, "Marco")).toMatchObject({
      role: "operatore",
      active: true,
    });
  });

  test("keep everyone who has ever worked here, deactivated or not", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await operatore(t, "Marco", "auth|marco");
    await gabriele.mutation(api.operatori.deactivate, {
      operatoreId: (await staffMember(gabriele, "Marco"))._id,
    });

    expect(await gabriele.query(api.operatori.list, {})).toEqual([
      {
        _id: expect.anything(),
        name: "Gabriele",
        email: "gabriele@frantoio.example",
        role: "admin",
        active: true,
      },
      {
        _id: expect.anything(),
        name: "Marco",
        email: "marco@frantoio.example",
        role: "operatore",
        active: false,
      },
    ]);
  });
});

describe("a refusal to somebody who is not an Operatore", () => {
  test("says which of the three ways of being nobody this is", async () => {
    const t = startApp();
    const gabriele = await admin(t);

    // Nobody at all: the connection carries no session. This is what a screen
    // that read before its connection was authenticated leaves in the logs.
    await expect(t.query(api.campagne.list, {})).rejects.toThrow(
      "No session on this device: nobody is signed in.",
    );

    // A session the mill has no Operatore against: signed in, unknown here.
    const stranger = t.withIdentity({ subject: "auth-user-nobody-hired" });
    await expect(stranger.query(api.campagne.list, {})).rejects.toThrow(
      "Signed in as auth-user-nobody-hired, but the mill has no Operatore against that account.",
    );

    // An Operatore the mill has let go, whose device still holds a session.
    const marco = await operatore(t, "Marco", "auth-user-marco");
    await gabriele.mutation(api.operatori.deactivate, {
      operatoreId: (await staffMember(gabriele, "Marco"))._id,
    });
    await expect(marco.query(api.campagne.list, {})).rejects.toThrow(
      "The Operatore Marco has been deactivated.",
    );
  });
});
