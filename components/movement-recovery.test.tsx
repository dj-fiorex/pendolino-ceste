// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RientroFlow } from "./rientro-flow";
import { RitiroFlow } from "./ritiro-flow";
import { SvuotamentoScreen } from "./svuotamento-screen";

const state = vi.hoisted(() => ({
  connected: true,
  mutate: vi.fn(),
  cliente: { _id: "cliente-1", name: "Mario", alias: [], phone: null },
  cesta: {
    _id: "cesta-1",
    numero: 1,
    codice: "400-R-001",
    portata: 400,
    state: "fuori",
    cliente: { _id: "cliente-1", name: "Mario", alias: [], phone: null },
  },
}));
vi.mock("convex/react", () => ({
  useMutation: () => state.mutate,
  useQuery: (query: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (getFunctionName(query as never) === "clienti:get")
      return { cesteFuori: [{ ...state.cesta, since: Date.now() }] };
    return [
      {
        cliente: state.cliente,
        oldestRientro: Date.now(),
        ceste: [state.cesta],
      },
    ];
  },
}));
vi.mock("./pwa-provider", () => ({
  useMovementConnection: () => state.connected,
  useMovementActivity: () => {},
}));
vi.mock("./campagna-bar", () => ({
  useCampagnaChoice: () => ({ mustAsk: false, campagnaId: undefined }),
}));
vi.mock("./cesta-reader", () => ({
  CestaReader: ({ onCesta }: { onCesta: (cesta: unknown) => void }) => (
    <button onClick={() => onCesta(state.cesta)}>Leggi Cesta</button>
  ),
}));
vi.mock("./cliente-picker", () => ({
  ClientePicker: ({ onPick }: { onPick: (cliente: unknown) => void }) => (
    <button onClick={() => onPick(state.cliente)}>Scegli Mario</button>
  ),
}));
vi.mock("./ritiro-media", () => ({
  NOTHING_CAPTURED: { signature: null, photo: null },
  RitiroMedia: () => null,
}));
vi.mock("./numero-keypad", () => ({ NumeroKeypad: () => null }));
vi.mock("@/lib/sound", () => ({ playConfirmation: () => {} }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  state.connected = true;
  state.mutate.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function show(flow: "ritiro" | "rientro" | "svuotamento") {
  await act(async () =>
    root.render(
      flow === "ritiro" ? (
        <RitiroFlow />
      ) : flow === "rientro" ? (
        <RientroFlow />
      ) : (
        <SvuotamentoScreen />
      ),
    ),
  );
}
async function reopen(flow: "ritiro" | "rientro" | "svuotamento") {
  await act(async () => root.unmount());
  root = createRoot(host);
  await show(flow);
}
function button(text: string) {
  const result = [...host.querySelectorAll("button")].find(
    (element) =>
      element.getAttribute("aria-label")?.includes(text) ||
      element.textContent?.includes(text),
  );
  if (!result) throw new Error(`Missing button ${text}: ${host.textContent}`);
  return result;
}
async function click(text: string) {
  await act(async () => button(text).click());
}

test("Svuotamento survives remount, blocks offline confirmation, and clears only on server success", async () => {
  await show("svuotamento");
  await click("400-R-001");
  await reopen("svuotamento");
  expect(host.textContent).toContain("lasciato a metà");
  await click("Riprendi Svuotamento");
  state.connected = false;
  await show("svuotamento");
  expect(button("Svuota").disabled).toBe(true);
  await click("Svuota");
  expect(state.mutate).not.toHaveBeenCalled();
  state.connected = true;
  await show("svuotamento");
  state.mutate.mockRejectedValueOnce(new Error("connection lost"));
  await click("Svuota");
  expect(localStorage.getItem("pendolino.svuotamento")).not.toBeNull();
  expect(host.textContent).toContain("Non è stato possibile");
  await click("Svuota");
  expect(localStorage.getItem("pendolino.svuotamento")).toBeNull();
});

test("Rientro resumes the identified Cliente and selected Ceste, waits for server confirmation", async () => {
  await show("rientro");
  await click("Leggi Cesta");
  await click("Rientro di Mario");
  await reopen("rientro");
  expect(host.textContent).toContain("Mario");
  await click("Riprendi Rientro");
  let finish!: () => void;
  state.mutate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await click("Registra Rientro");
  expect(host.textContent).not.toContain("Rientro registrato");
  expect(localStorage.getItem("pendolino.rientro")).not.toBeNull();
  await act(async () => finish());
  expect(host.textContent).toContain("Rientro registrato");
  expect(localStorage.getItem("pendolino.rientro")).toBeNull();
});

test("Ritiro keeps its existing explicit recovery and refuses offline submission", async () => {
  await show("ritiro");
  await click("Scegli Mario");
  await click("Leggi Cesta");
  await reopen("ritiro");
  await click("Riprendi il Ritiro");
  state.connected = false;
  await show("ritiro");
  expect(button("Conferma Ritiro").disabled).toBe(true);
  state.connected = true;
  await show("ritiro");
  await click("Conferma Ritiro");
  expect(host.textContent).toContain("Ritiro registrato");
  expect(localStorage.getItem("pendolino.ritiro")).toBeNull();
});

test("discarding a saved movement cannot silently restore it again", async () => {
  await show("svuotamento");
  await click("400-R-001");
  await reopen("svuotamento");
  await click("Ricomincia da capo");
  await reopen("svuotamento");
  expect(host.textContent).not.toContain("lasciato a metà");
});

test("invalid stored drafts do not crash the flow", async () => {
  localStorage.setItem(
    "pendolino.rientro",
    JSON.stringify({ version: 1, draft: { cliente: {}, ticked: [null] } }),
  );
  await show("rientro");
  expect(host.textContent).toContain("Leggi Cesta");
});

test.each(["ritiro", "rientro", "svuotamento"] as const)(
  "%s warns after closing during confirmation and never automatically resubmits",
  async (flow) => {
    await show(flow);
    if (flow === "ritiro") await click("Scegli Mario");
    if (flow === "svuotamento") await click("400-R-001");
    else await click("Leggi Cesta");
    if (flow === "rientro") await click("Rientro di Mario");
    state.mutate.mockImplementationOnce(() => new Promise(() => {}));
    await click(
      flow === "ritiro"
        ? "Conferma Ritiro"
        : flow === "rientro"
          ? "Registra Rientro"
          : "Svuota",
    );
    await reopen(flow);
    expect(host.textContent).toContain(
      "Il Movimento potrebbe essere già registrato",
    );
    expect(state.mutate).toHaveBeenCalledTimes(1);
  },
);

test("storage failure is visible while the current selection remains usable", async () => {
  await show("svuotamento");
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("quota exceeded");
  });
  await click("400-R-001");
  expect(host.textContent).toContain("non riesce a salvare il lavoro");
  expect(button("Svuota").disabled).toBe(false);
});
