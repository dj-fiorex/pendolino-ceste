// @vitest-environment happy-dom
import { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Cliente } from "@/lib/cliente";
import { ClientePicker } from "./cliente-picker";

const database = vi.hoisted(() => ({
  pages: {} as Record<string, (Cliente | null)[][]>,
  loading: null as "LoadingFirstPage" | "LoadingMore" | null,
  create: vi.fn(),
}));

// The Convex subscription is the external boundary. Each page here already
// contains the backend's matches; DOM assertions exercise picker behavior.
vi.mock("convex/react", () => ({
  useMutation: () => database.create,
  useQuery: () => [],
  usePaginatedQuery: (_query: unknown, { term }: { term: string }) => {
    const [count, setCount] = useState(1);
    const pages = database.pages[term] ?? [[]];
    const loadMore = useCallback(() => setCount((value) => value + 1), []);
    return {
      results: pages.slice(0, count).flat(),
      status:
        database.loading ??
        (count < pages.length ? "CanLoadMore" : "Exhausted"),
      loadMore,
    };
  },
}));

const oleificio: Cliente = {
  _id: "cliente-cellulare" as Cliente["_id"],
  name: "Oleificio Cellulare",
  alias: [],
  phone: null,
  smsOptOut: false,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  database.pages = {};
  database.loading = null;
  database.create.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function typeSearch(value: string) {
  const input = container.querySelector("input");
  if (!input) throw new Error("Search input missing");
  await typeInput(input, value);
}

async function typeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("selects the saved Cliente returned by creation unchanged", async () => {
  const saved: Cliente = {
    ...oleificio,
    name: "Mario Rossi",
    alias: ["u' pilota"],
    phone: "+393331234567",
  };
  database.create.mockResolvedValue(saved);
  const onPick = vi.fn();
  await act(async () =>
    root.render(<ClientePicker creating onPick={onPick} pickLabel="Ritiro" />),
  );
  for (const [id, value] of [
    ["cliente-name", "  mARIO   ROSSI  "],
    ["cliente-alias", "  u'   pilota  "],
    ["cliente-phone", "333 123 4567"],
  ]) {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Input ${id} missing`);
    await typeInput(input, value);
  }

  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  expect(database.create).toHaveBeenCalledWith({
    name: "  mARIO   ROSSI  ",
    alias: ["u'   pilota"],
    phone: "333 123 4567",
  });
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onPick.mock.calls[0][0]).toBe(saved);
});

test("continues through empty pages and lets the Operatore pick the later match", async () => {
  database.pages["oleificio cellulare"] = [[], [], [oleificio]];
  const onPick = vi.fn();
  await act(async () =>
    root.render(<ClientePicker onPick={onPick} pickLabel="Ritiro" />),
  );
  await typeSearch("oleificio cellulare");

  const pick = container.querySelector<HTMLButtonElement>(
    '[aria-label="Ritiro: Oleificio Cellulare"]',
  );
  expect(pick).not.toBeNull();
  expect(container.textContent).not.toContain("Nessun Cliente");
  await act(async () => pick!.click());
  expect(onPick).toHaveBeenCalledWith(oleificio);
});

test("pauses a broad search honestly and resumes when the Operatore asks", async () => {
  database.pages["oleificio cellulare"] = [
    ...Array.from({ length: 10 }, () => []),
    [oleificio],
  ];
  await act(async () =>
    root.render(<ClientePicker onPick={vi.fn()} pickLabel="Ritiro" />),
  );
  await typeSearch("oleificio cellulare");

  expect(container.textContent).toContain("Ricerca non completata");
  expect(container.textContent).not.toContain("Nessun Cliente");
  expect(container.querySelectorAll("li")).toHaveLength(0);
  const more = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Continua a cercare",
  );
  expect(more).toBeDefined();
  await act(async () => more!.click());

  expect(container.textContent).toContain("Oleificio Cellulare");
  expect(container.textContent).not.toContain("Ricerca non completata");
});

test("a different term discards old matches and gets a fresh continuation budget", async () => {
  database.pages["oleificio"] = [
    [oleificio],
    ...Array.from({ length: 12 }, () => []),
  ];
  const anna = {
    ...oleificio,
    _id: "cliente-anna" as Cliente["_id"],
    name: "Anna Rossi",
  };
  database.pages["anna"] = [[], [anna]];
  await act(async () =>
    root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
  );
  await typeSearch("oleificio");
  expect(container.textContent).toContain("Ricerca non completata");

  await typeSearch("anna");
  expect(container.textContent).toContain("Anna Rossi");
  expect(container.textContent).not.toContain("Oleificio Cellulare");
  expect(container.textContent).not.toContain("Ricerca non completata");
});

test("stops at twenty matches and presents them alphabetically", async () => {
  const clienti = Array.from({ length: 20 }, (_, index) => ({
    ...oleificio,
    _id: `cliente-${index}` as Cliente["_id"],
    name: `Rossi ${String(19 - index).padStart(2, "0")}`,
  }));
  database.pages["rossi"] = [clienti, [oleificio]];
  await act(async () =>
    root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
  );
  await typeSearch("rossi");

  const rows = container.querySelectorAll("li");
  expect(rows).toHaveLength(20);
  expect(rows[0].textContent).toContain("Rossi 00");
  expect(rows[19].textContent).toContain("Rossi 19");
  expect(container.textContent).not.toContain("Oleificio Cellulare");
  expect(container.textContent).toContain("Mostro i primi 20 risultati");
});

test("only an exhausted search says that no Cliente matches", async () => {
  database.pages["sconosciuto"] = [[], []];
  await act(async () =>
    root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
  );
  await typeSearch("sconosciuto");
  expect(container.textContent).toContain("Nessun Cliente con questo nome.");
  expect(container.textContent).not.toContain("Continua a cercare");
});

test.each(["LoadingFirstPage", "LoadingMore"] as const)(
  "%s shows progress instead of a false empty result",
  async (status) => {
    database.loading = status;
    await act(async () =>
      root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Cerco i Clienti",
    );
    expect(container.textContent).not.toContain("Nessun Cliente");

    database.loading = null;
    await act(async () =>
      root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
    );
    expect(container.textContent).toContain("Nessun Cliente con questo nome.");
  },
);

test("selects twenty across page boundaries before sorting for display", async () => {
  const first = Array.from({ length: 19 }, (_, index) => ({
    ...oleificio,
    _id: `cliente-${index}` as Cliente["_id"],
    name: `Rossi ${index}`,
  }));
  database.pages["rossi"] = [
    first,
    [
      { ...oleificio, _id: "last-match" as Cliente["_id"], name: "Zeno Rossi" },
      {
        ...oleificio,
        _id: "excluded-match" as Cliente["_id"],
        name: "Anna Rossi",
      },
    ],
  ];
  await act(async () =>
    root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
  );
  await typeSearch("rossi");
  expect(container.querySelectorAll("li")).toHaveLength(20);
  expect(container.textContent).toContain("Zeno Rossi");
  expect(container.textContent).not.toContain("Anna Rossi");
});

test("a search at Convex's candidate limit asks for a narrower term, not a false no-match", async () => {
  database.pages["oleificio assente"] = [
    Array.from({ length: 1024 }, () => null),
  ];
  await act(async () =>
    root.render(<ClientePicker onPick={vi.fn()} pickLabel="Scegli" />),
  );
  await typeSearch("oleificio assente");
  expect(container.textContent).toContain("Ricerca troppo ampia");
  expect(container.textContent).not.toContain("Nessun Cliente");
  expect(container.textContent).not.toContain("Continua a cercare");
});
