// @vitest-environment happy-dom
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import { RegistroList } from "./registro-list";

const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useQuery: (...args: Parameters<typeof useQuery>) => query(...args),
}));

const groupedRitiro = {
  _id: "registro-ritiro",
  at: new Date("2026-09-19T08:30:00+02:00").getTime(),
  operatore: "Operatore",
  cliente: { name: "Carmelo Fiorello", alias: [] },
  campagna: "2026/2027",
  producedRettifica: true,
  discrepanze: [
    {
      numero: 2,
      believedState: "fuori",
      becomes: "fuori",
      cliente: { name: "Abissi Vincenzo", alias: [] },
    },
    {
      numero: 5,
      believedState: "attesa_molitura",
      becomes: "fuori",
      cliente: null,
    },
  ],
  corrects: null,
  correctedBy: [],
  media: { signature: null, photo: null },
  sms: null,
  action: { kind: "ritiro", numeri: [2, 5] },
} as const;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  query
    .mockReset()
    .mockImplementation((reference) =>
      getFunctionName(reference) === getFunctionName(api.registro.filterOptions)
        ? { clienti: [], operatori: [] }
        : [groupedRitiro],
    );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("a grouped Ritiro names every automatic Rettifica", async () => {
  await act(async () => {
    root.render(<RegistroList initialDay="2026-09-19" />);
  });

  expect(container.textContent).toContain("Rettifiche automatiche");
  expect(container.textContent).toContain(
    "La Cesta 2 risultava Fuori con Abissi Vincenzo.",
  );
  expect(container.textContent).toContain(
    "La Cesta 5 risultava in Attesa molitura.",
  );
});

test("Solo rettifiche asks for manual and automatic Rettifiche", async () => {
  await act(async () => {
    root.render(<RegistroList initialDay="2026-09-19" />);
  });
  const filter = container.querySelector('[role="switch"]');
  expect(filter).not.toBeNull();

  await act(async () => {
    (filter as HTMLButtonElement).click();
  });

  const listCalls = query.mock.calls.filter(
    ([reference]) =>
      getFunctionName(reference) === getFunctionName(api.registro.list),
  );
  expect(listCalls.at(-1)?.[1]).toMatchObject({ producedRettifica: true });
});
