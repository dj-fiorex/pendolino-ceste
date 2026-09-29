// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RientroFlow } from "./rientro-flow";

const giuseppe = {
  _id: "giuseppe",
  name: "Giuseppe",
  alias: [],
  phone: null,
  smsOptOut: false,
};
const held = [
  {
    _id: "cesta-17",
    numero: 17,
    codice: "400-R-017",
    portata: 400,
    forma: "R",
    since: 0,
  },
  {
    _id: "cesta-18",
    numero: 18,
    codice: "400-R-018",
    portata: 400,
    forma: "R",
    since: 0,
  },
];

const backend = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: () => backend.record,
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "campagne:list"
      ? []
      : { ...giuseppe, cesteFuori: held },
  usePaginatedQuery: () => ({
    results: [giuseppe],
    status: "Exhausted",
    loadMore: () => {},
  }),
  useConvex: () => backend,
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  backend.record.mockReset();
  backend.record.mockResolvedValue(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function button(text: string) {
  const found = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

test("a Rientro can start from the Cliente, with nothing ticked", async () => {
  await act(async () => root.render(<RientroFlow />));
  expect(container.textContent).toContain("Basta una Cesta qualsiasi");

  await act(async () => button("Cerca il Cliente").click());
  expect(container.textContent).toContain("Cerca chi sta riportando le Ceste");
  expect(container.textContent).toContain("Nuovo Cliente");

  await act(async () => button("Giuseppe").click());
  expect(container.textContent).toContain("Ceste di Giuseppe");
  expect(container.textContent).not.toContain("Letta ");
  const tiles = [...container.querySelectorAll("[aria-pressed]")];
  expect(tiles).toHaveLength(2);
  expect(
    tiles.every((tile) => tile.getAttribute("aria-pressed") === "false"),
  ).toBe(true);
  expect(button("Registra Rientro").disabled).toBe(true);

  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Cesta 400-R-018"]')!
      .click(),
  );
  expect(button("Registra Rientro").disabled).toBe(false);
  expect(container.textContent).toContain(
    "Resta Fuori con Giuseppe: 400-R-017",
  );

  await act(async () => button("Registra Rientro").click());
  expect(backend.record).toHaveBeenCalledExactlyOnceWith({
    clienteId: "giuseppe",
    cesteIds: ["cesta-18"],
    campagnaId: undefined,
  });
  expect(container.textContent).toContain("Rientro registrato");
});

test("the search can be left for the reader again", async () => {
  await act(async () => root.render(<RientroFlow />));
  await act(async () => button("Cerca il Cliente").click());
  await act(async () => button("Leggi una Cesta invece").click());
  expect(container.textContent).toContain("Basta una Cesta qualsiasi");
  expect(container.textContent).not.toContain("Nuovo Cliente");
});
