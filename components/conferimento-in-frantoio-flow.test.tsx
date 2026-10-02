// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IncomingCesteFlow } from "./incoming-ceste-flow";

const giuseppe = {
  _id: "giuseppe",
  name: "Giuseppe",
  alias: [],
  phone: null,
  smsOptOut: false,
};
const maria = { ...giuseppe, _id: "maria", name: "Maria" };
const backend = vi.hoisted(() => ({
  record: vi.fn(),
  query: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "movimenti:conferimentoInFrantoio"
      ? backend.record
      : vi.fn(),
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === "skip") return undefined;
    backend.subscribe(getFunctionName(reference));
    return getFunctionName(reference) === "campagne:list"
      ? []
      : {
          ...giuseppe,
          cesteFuori: [
            { _id: "cesta-18", numero: 18, codice: "400-R-018", since: 0 },
          ],
        };
  },
  usePaginatedQuery: () => ({
    results: [giuseppe, maria],
    status: "Exhausted",
    loadMore: () => {},
  }),
  useConvex: () => backend,
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  backend.record.mockReset().mockResolvedValue(null);
  backend.subscribe.mockReset();
  backend.query.mockReset().mockResolvedValue({
    _id: "cesta-17",
    numero: 17,
    codice: "400-R-017",
    portata: 400,
    state: "disponibile",
    cliente: null,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function button(text: string) {
  const found = [...document.querySelectorAll("button")].find(
    (candidate) =>
      candidate.getAttribute("aria-label") === text ||
      candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
const click = async (text: string) => {
  await act(async () => button(text).click());
};
const open = async () => {
  await act(async () =>
    root.render(<IncomingCesteFlow kind="conferimento_in_frantoio" />),
  );
};
const addNumero = async () => {
  await click("Numero");
  await click("1");
  await click("7");
  await click("Aggiungi");
  await click("Chiudi");
};

test("Cliente first, then only the filled Ceste, with no SMS or Fuori suggestions", async () => {
  await open();
  expect(container.textContent).toContain("Cerca il Cliente");
  expect(container.textContent).not.toContain("Numero");
  await click("Giuseppe");
  expect(container.querySelectorAll("[aria-pressed]")).toHaveLength(0);
  expect(backend.subscribe).not.toHaveBeenCalledWith("clienti:get");
  expect(container.textContent).not.toMatch(/Fuori|400-R-018|SMS/i);
  expect(button("Registra Conferimento in frantoio").disabled).toBe(true);

  await addNumero();
  expect(container.querySelectorAll("[aria-pressed=true]")).toHaveLength(1);
  expect(container.textContent).not.toContain("Rettifica");
  await click("Registra Conferimento in frantoio");
  expect(backend.record).toHaveBeenCalledExactlyOnceWith({
    clienteId: "giuseppe",
    cesteIds: ["cesta-17"],
    campagnaId: undefined,
  });
  expect(container.textContent).toContain(
    "Conferimento in frantoio registrato",
  );
  await click("Nuovo Conferimento in frantoio");
  expect(container.textContent).toContain("Cerca il Cliente");
});

test("adding twice keeps one Cesta, and changing Cliente preserves the selection", async () => {
  await open();
  await click("Giuseppe");
  await addNumero();
  await addNumero();
  expect(container.querySelectorAll("[aria-pressed]")).toHaveLength(1);
  await click("Cesta 400-R-017");
  expect(button("Registra Conferimento in frantoio").disabled).toBe(true);
  await click("Cesta 400-R-017");
  await click("Cambia Cliente");
  await click("Maria");
  expect(container.querySelectorAll("[aria-pressed=true]")).toHaveLength(1);
  await click("Registra Conferimento in frantoio");
  expect(backend.record).toHaveBeenCalledExactlyOnceWith({
    clienteId: "maria",
    cesteIds: ["cesta-17"],
    campagnaId: undefined,
  });
});

test("an unexpected state warns without blocking the Conferimento", async () => {
  backend.query.mockResolvedValue({
    _id: "cesta-17",
    numero: 17,
    codice: "400-R-017",
    portata: 400,
    state: "fuori",
    cliente: maria,
  });
  await open();
  await click("Giuseppe");
  await addNumero();
  expect(container.textContent).toContain("Rettifica");
  expect(container.textContent).toContain("Maria");
  expect(button("Registra Conferimento in frantoio").disabled).toBe(false);
  await click("Registra Conferimento in frantoio");
  expect(backend.record).toHaveBeenCalledOnce();
});

test("a failed registration keeps the selection for retry and freezes it while pending", async () => {
  backend.record.mockRejectedValueOnce(new Error("offline"));
  await open();
  await click("Giuseppe");
  await addNumero();
  await click("Registra Conferimento in frantoio");
  expect(container.textContent).toContain("Non è stato possibile registrare");
  expect(container.querySelectorAll("[aria-pressed=true]")).toHaveLength(1);
  let finish: () => void = () => {
    throw new Error("Registration did not start");
  };
  backend.record.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await click("Registra Conferimento in frantoio");
  expect(button("Cambia Cliente").disabled).toBe(true);
  expect(button("Cesta 400-R-017").disabled).toBe(true);
  expect(button("Un attimo…").disabled).toBe(true);
  await act(async () => finish());
  expect(container.textContent).toContain(
    "Conferimento in frantoio registrato",
  );
});
