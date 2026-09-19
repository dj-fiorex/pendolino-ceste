/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema, { MAX_SEARCH_RESULTS } from "./schema";

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

describe("the Cliente at the counter", () => {
  test("is created with nothing but a name, and found by it", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
        smsOptOut: false,
      },
    ]);
  });
});

describe("the name in the registry's own casing", () => {
  test("shouting and whispering both read back capitalised", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await marco.mutation(api.clienti.create, { name: "MARIO ROSSI" });
    await marco.mutation(api.clienti.create, { name: "de luca  giuseppe" });
    await marco.mutation(api.clienti.create, { name: "D'AMATO ANNA" });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["D'Amato Anna", "De Luca Giuseppe", "Mario Rossi"]);
  });

  test("the Soprannome is left as the counter said it", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await marco.mutation(api.clienti.create, {
      name: "AMATO GIUSEPPE",
      alias: ["u' pilota"],
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "pilota",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: expect.any(String),
        name: "Amato Giuseppe",
        alias: ["u' pilota"],
        phone: null,
        smsOptOut: false,
      },
    ]);
  });

  test("casing tells nobody apart: the shouted namesake is still refused", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    await expect(
      marco.mutation(api.clienti.create, { name: "GIUSEPPE AMATO" }),
    ).rejects.toThrow();

    expect(
      await marco.query(api.clienti.namesakes, { name: "GIUSEPPE AMATO" }),
    ).toHaveLength(1);
  });

  test("a correction is capitalised too", async () => {
    const t = startApp();
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giusepe Amato",
    });

    await marco.mutation(api.clienti.update, {
      clienteId,
      name: "GIUSEPPE AMATO",
      alias: [],
      phone: "",
      smsOptOut: false,
    });

    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      name: "Giuseppe Amato",
    });
  });
});

describe("finding a Cliente in a registry of thousands", () => {
  test("words can span a name and Alias, with punctuation treated as word boundaries", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, {
      name: "D'Amato Anna",
      alias: ["u' pilota"],
    });
    await marco.mutation(api.clienti.create, { name: "D'Amato Mario" });
    for (const term of ["D'AMATO   pilo", "anna-pilota", "amato pilota "]) {
      const found = await marco.query(api.clienti.search, {
        term,
        paginationOpts: { numItems: 20, cursor: null },
      });
      expect(
        found.page
          .filter((cliente) => cliente !== null)
          .map((cliente) => cliente.name),
      ).toEqual(["D'Amato Anna"]);
    }
    const partialCompletedWord = await marco.query(api.clienti.search, {
      term: "amat pilo",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(
      partialCompletedWord.page.filter((cliente) => cliente !== null),
    ).toEqual([]);
  });

  test("punctuation alone matches nobody, while whitespace browses active Clienti", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Anna Rossi" });
    const punctuation = await marco.query(api.clienti.search, {
      term: "--- ' !!!",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(punctuation.page.filter((cliente) => cliente !== null)).toEqual([]);
    expect(punctuation.isDone).toBe(true);
    const browse = await marco.query(api.clienti.search, {
      term: "  ",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(
      browse.page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["Anna Rossi"]);
  });

  test("a page without matches can be continued to find a later match", async () => {
    const t = startApp();
    const marco = await operatore(t);
    for (let index = 0; index < 25; index++) {
      await marco.mutation(api.clienti.create, {
        name: `Oleificio Rossi ${index}`,
      });
    }
    await marco.mutation(api.clienti.create, { name: "Oleificio Cellulare" });

    const first = await marco.query(api.clienti.search, {
      term: "oleificio cellulare",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(first.page).toHaveLength(20);
    expect(first.page.every((cliente) => cliente === null)).toBe(true);
    expect(first.isDone).toBe(false);

    const next = await marco.query(api.clienti.search, {
      term: "oleificio cellulare",
      paginationOpts: { numItems: 20, cursor: first.continueCursor },
    });
    expect(
      next.page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["Oleificio Cellulare"]);
    expect(next.isDone).toBe(true);
  });

  test("every word must match, with a prefix allowed for the final word", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Oleificio Cellulare" });
    await marco.mutation(api.clienti.create, { name: "Oleificio Rossi" });
    await marco.mutation(api.clienti.create, { name: "Mario Cellulare" });

    for (const term of [
      "oleificio cellulare",
      "oleificio cell",
      "cellulare oleificio",
    ]) {
      expect(
        (
          await marco.query(api.clienti.search, {
            term,
            paginationOpts: { numItems: 20, cursor: null },
          })
        ).page
          .filter((cliente) => cliente !== null)
          .map((cliente) => cliente.name),
      ).toEqual(["Oleificio Cellulare"]);
    }
  });

  test("a few letters of a surname are enough, and so are a few of a Soprannome", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Cipolla Giuseppe" });
    await marco.mutation(api.clienti.create, {
      name: "Amato Salvatore",
      alias: ["u' pilota"],
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "cipo",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["Cipolla Giuseppe"]);
    expect(
      (
        await marco.query(api.clienti.search, {
          term: "pilo",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["Amato Salvatore"]);
  });

  test("browses in name order, whoever was written down first", async () => {
    const t = startApp();
    const marco = await operatore(t);
    for (const name of ["Rossi Mario", "Rossi Anna", "Rossi Nicola"]) {
      await marco.mutation(api.clienti.create, { name });
    }

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["Rossi Anna", "Rossi Mario", "Rossi Nicola"]);
  });

  test("hands back no more than the counter can read", async () => {
    const t = startApp();
    const marco = await operatore(t);
    for (const numero of [...Array(MAX_SEARCH_RESULTS + 5).keys()]) {
      await marco.mutation(api.clienti.create, {
        name: `Rossi ${String(numero).padStart(2, "0")}`,
      });
    }

    // Candidate selection stays in index order. The picker sorts only after
    // selecting twenty matches across pages (ADR-0010).
    const found = (
      await marco.query(api.clienti.search, {
        term: "rossi",
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page.filter((cliente) => cliente !== null);
    expect(found).toHaveLength(MAX_SEARCH_RESULTS);
  });
});

describe("two Clienti with the same name", () => {
  test("the second is refused, and the first is the one to pick", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    await expect(
      marco.mutation(api.clienti.create, { name: "giuseppe  amato" }),
    ).rejects.toThrow();

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
        smsOptOut: false,
      },
    ]);
  });

  test("an Alias tells them apart, and the counter sees both", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
      phone: "333 111 2222",
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
        smsOptOut: false,
      },
      {
        _id: expect.any(String),
        name: "Giuseppe Amato",
        alias: ["Turi"],
        phone: "+393331112222",
        smsOptOut: false,
      },
    ]);
  });

  test("never share an Alias either, or nothing tells them apart", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    await expect(
      marco.mutation(api.clienti.create, {
        name: "Giuseppe Amato",
        alias: ["turi", "u' pilota"],
      }),
    ).rejects.toThrow();

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toHaveLength(1);
  });

  test("a deactivated namesake still needs telling apart, though nobody can pick them", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    await gabriele.mutation(api.clienti.deactivate, {
      clienteId,
      confirmed: false,
    });

    // They are gone from the search, and still on the Lista di recupero with
    // whatever Ceste they hold: a second Giuseppe Amato with nothing to tell
    // them apart is the confusion the rule exists to prevent (ADR-0004).
    expect(
      (
        await gabriele.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([]);
    await expect(
      gabriele.mutation(api.clienti.create, { name: "Giuseppe Amato" }),
    ).rejects.toThrow();
    expect(
      await gabriele.query(api.clienti.namesakes, { name: "giuseppe amato" }),
    ).toEqual([
      {
        _id: clienteId,
        name: "Giuseppe Amato",
        alias: [],
        phone: null,
        smsOptOut: false,
        active: false,
      },
    ]);

    await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["u' pilota"],
    });

    expect(
      (
        await gabriele.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toHaveLength(1);
  });

  test("a different name with the same Alias is two people the counter knows", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
      alias: ["Turi"],
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "turi",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toHaveLength(2);
  });
});

describe("the Registro", () => {
  test("carries the Cliente that was created, under the Operatore who did it", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);

    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });

    expect(await gabriele.query(api.registro.list, {})).toEqual([
      {
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
          kind: "cliente_creato",
          name: "Giuseppe Amato",
        },
      },
    ]);
  });
});

describe("correcting a Cliente", () => {
  test("any Operatore fixes the name, the Alias and the telephone", async () => {
    const t = startApp();
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giusepe Amato",
    });

    await marco.mutation(api.clienti.update, {
      clienteId,
      name: "Giuseppe Amato",
      alias: ["Turi", "u' pilota"],
      phone: "333 111 2222",
      smsOptOut: false,
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "pilota",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: clienteId,
        name: "Giuseppe Amato",
        alias: ["Turi", "u' pilota"],
        phone: "+393331112222",
        smsOptOut: false,
      },
    ]);
  });

  test("the correction is one Registro row, naming only what changed", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
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

    const registro = await gabriele.query(api.registro.list, {});
    expect(registro[0]).toEqual({
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
          {
            field: "phone",
            before: "+393331112222",
            after: "+393339998888",
          },
        ],
      },
    });
  });

  test("saving a Cliente unchanged records nothing", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      alias: ["Turi"],
    });

    await gabriele.mutation(api.clienti.update, {
      clienteId,
      name: "  Giuseppe   Amato ",
      alias: ["Turi"],
      phone: "",
      smsOptOut: false,
    });

    expect(await gabriele.query(api.registro.list, {})).toHaveLength(1);
  });

  test("a rename onto a namesake is refused, and the Cliente stays as it was", async () => {
    const t = startApp();
    const marco = await operatore(t);
    await marco.mutation(api.clienti.create, { name: "Giuseppe Amato" });
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Salvatore Russo",
    });

    await expect(
      marco.mutation(api.clienti.update, {
        clienteId,
        name: "Giuseppe Amato",
        alias: [],
        phone: "",
        smsOptOut: false,
      }),
    ).rejects.toThrow();

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "russo",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: clienteId,
        name: "Salvatore Russo",
        alias: [],
        phone: null,
        smsOptOut: false,
      },
    ]);
  });
});

describe("the telephone", () => {
  test("is kept as a carrier takes it, however the counter wrote it", async () => {
    const t = startApp();
    const marco = await operatore(t);

    for (const [typed, kept] of [
      ["347 1234567", "+393471234567"],
      ["3471234567", "+393471234567"],
      ["+39 347 123 4567", "+393471234567"],
      ["0039 347 1234567", "+393471234567"],
      // A landline: a good number to call, and one no SMS will reach.
      ["0931 000000", "+390931000000"],
      // Whoever winters abroad and still brings olives in October.
      ["+49 151 12345678", "+4915112345678"],
    ]) {
      const clienteId = await marco.mutation(api.clienti.create, {
        name: `Cliente ${typed}`,
        phone: typed,
      });
      const cliente = await marco.query(api.clienti.get, { clienteId });
      expect(cliente?.phone).toBe(kept);
    }
  });

  test("a number nobody could call is refused, at the moment it can be asked for", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await expect(
      marco.mutation(api.clienti.create, {
        name: "Giuseppe Amato",
        phone: "chiedere al figlio",
      }),
    ).rejects.toThrow();
    await expect(
      marco.mutation(api.clienti.create, {
        name: "Giuseppe Amato",
        phone: "347 12",
      }),
    ).rejects.toThrow();

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([]);
  });

  test("having none is not a mistake: the counter is never blocked", async () => {
    const t = startApp();
    const marco = await operatore(t);

    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "   ",
    });

    expect(
      (await marco.query(api.clienti.get, { clienteId }))?.phone,
    ).toBeNull();
  });

  test("a correction is refused the same way, and changes nothing", async () => {
    const t = startApp();
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
      phone: "347 1234567",
    });

    await expect(
      marco.mutation(api.clienti.update, {
        clienteId,
        name: "Giuseppe Amato",
        alias: [],
        phone: "347",
        smsOptOut: false,
      }),
    ).rejects.toThrow();

    expect((await marco.query(api.clienti.get, { clienteId }))?.phone).toBe(
      "+393471234567",
    );
  });
});

describe("deactivating a Cliente", () => {
  test("takes them out of the search, and is an Admin's to do", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    const marco = await operatore(t);
    const clienteId = await marco.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });

    await expect(
      marco.mutation(api.clienti.deactivate, { clienteId, confirmed: false }),
    ).rejects.toThrow();
    await gabriele.mutation(api.clienti.deactivate, {
      clienteId,
      confirmed: false,
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "amato",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([]);
    expect(await marco.query(api.clienti.get, { clienteId })).toMatchObject({
      name: "Giuseppe Amato",
      active: false,
    });
  });

  test("waits for a confirmation while they still hold Ceste, and keeps them", async () => {
    const t = startApp();
    const gabriele = await admin(t);
    await gabriele.mutation(api.ceste.censimento, {
      portata: 400,
      forma: "rettangolare",
      count: 3,
    });
    const clienteId = await gabriele.mutation(api.clienti.create, {
      name: "Giuseppe Amato",
    });
    const cesta = await gabriele.query(api.ceste.byNumero, { numero: "2" });
    await gabriele.mutation(api.movimenti.ritiro, {
      clienteId,
      cesteIds: cesta === null ? [] : [cesta._id],
    });

    await expect(
      gabriele.mutation(api.clienti.deactivate, {
        clienteId,
        confirmed: false,
      }),
    ).rejects.toThrow();
    expect(await gabriele.query(api.clienti.get, { clienteId })).toMatchObject({
      active: true,
    });

    await gabriele.mutation(api.clienti.deactivate, {
      clienteId,
      confirmed: true,
    });

    // Nobody leaves the Lista di recupero for being deactivated: only a
    // Rientro or a Rettifica takes a Cesta off it (CONTEXT.md, #22).
    expect(await gabriele.query(api.clienti.get, { clienteId })).toMatchObject({
      active: false,
      cesteFuori: [expect.objectContaining({ codice: "400-R-002" })],
    });
    expect(await gabriele.query(api.registro.list, {})).toContainEqual({
      _id: expect.any(String),
      at: expect.any(Number),
      operatore: "Gabriele",
      cliente: { name: "Giuseppe Amato", alias: [] },
      campagna: null,
      producedRettifica: false,
      discrepanze: [],
      corrects: null,
      correctedBy: [],
      media: { signature: null, photo: null },
      sms: null,
      action: {
        kind: "cliente_disattivato",
        name: "Giuseppe Amato",
        numeriFuori: [2],
      },
    });
  });
});
