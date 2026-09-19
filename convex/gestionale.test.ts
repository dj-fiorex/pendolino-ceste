/// <reference types="vite/client" />

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const startApp = () => {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
};

/** Somebody at the counter, so that the imported registry can be read back. */
const operatore = async (t: TestConvex<typeof schema>) => {
  await t.mutation(internal.operatori.create, {
    authUserId: "auth|marco",
    name: "Marco",
    email: "marco@frantoio.example",
    role: "operatore",
  });
  return t.withIdentity({ subject: "auth|marco" });
};

/** The Gestionale shouts every name, which is how OleaPlus holds one. */
const row = (gestionaleId: string, name: string, phone = "") => ({
  gestionaleId,
  name,
  phone,
});

describe("the Gestionale's registry, imported", () => {
  test("arrives in the registry's own casing, however OleaPlus held it", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await t.mutation(internal.gestionale.importRegistry, {
      rows: [row("1", "CIPOLLA GIUSEPPE"), row("2", "d'amato anna")],
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page
        .filter((cliente) => cliente !== null)
        .map((cliente) => cliente.name),
    ).toEqual(["Cipolla Giuseppe", "D'Amato Anna"]);
  });

  test("is found by a few letters, like anybody entered at the counter", async () => {
    const t = startApp();
    const marco = await operatore(t);

    await t.mutation(internal.gestionale.importRegistry, {
      rows: [row("1", "CIPOLLA GIUSEPPE", "333 111 2222")],
    });

    expect(
      (
        await marco.query(api.clienti.search, {
          term: "cipo",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: expect.any(String),
        name: "Cipolla Giuseppe",
        alias: [],
        phone: "+393331112222",
        smsOptOut: false,
      },
    ]);
  });

  test("inserts nobody twice, and skips the namesake nothing tells apart", async () => {
    const t = startApp();
    const marco = await operatore(t);
    const rows = [
      row("1", "CIPOLLA GIUSEPPE"),
      // A second Codice, the same name: OleaPlus knows two men and the
      // spreadsheet says nothing that would tell them apart.
      row("2", "cipolla  giuseppe"),
    ];

    const first = await t.mutation(internal.gestionale.importRegistry, {
      rows,
    });
    const second = await t.mutation(internal.gestionale.importRegistry, {
      rows,
    });

    expect(first.map((one) => one.outcome)).toEqual(["imported", "namesake"]);
    expect(second.map((one) => one.outcome)).toEqual([
      "already_present",
      "namesake",
    ]);
    expect(
      (
        await marco.query(api.clienti.search, {
          term: "cipolla",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      {
        _id: expect.any(String),
        name: "Cipolla Giuseppe",
        alias: [],
        phone: null,
        smsOptOut: false,
      },
    ]);
  });

  test("a telephone nobody could dial is reported and the Cliente still goes in", async () => {
    const t = startApp();
    const marco = await operatore(t);

    const results = await t.mutation(internal.gestionale.importRegistry, {
      rows: [row("1", "CIPOLLA GIUSEPPE", "333 111 2222 / 340 555 6666")],
    });

    expect(results).toEqual([
      {
        gestionaleId: "1",
        name: "Cipolla Giuseppe",
        outcome: "imported",
        phoneUnreadable: true,
      },
    ]);
    expect(
      (
        await marco.query(api.clienti.search, {
          term: "cipolla",
          paginationOpts: { numItems: 20, cursor: null },
        })
      ).page.filter((cliente) => cliente !== null),
    ).toEqual([
      expect.objectContaining({ name: "Cipolla Giuseppe", phone: null }),
    ]);
  });
});
