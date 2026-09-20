// @vitest-environment happy-dom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RitiroFlow } from "./ritiro-flow";
import { RitiroProvider } from "./ritiro-provider";

const backend = vi.hoisted(() => ({
  record: vi.fn(),
  uploadUrl: vi.fn(),
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "movimenti:ritiro"
      ? backend.record
      : backend.uploadUrl,
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "campagne:list" ? [] : { cesteFuori: [] },
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
  useConvex: () => backend,
}));

const saved = {
  cliente: {
    _id: "giuseppe",
    name: "Giuseppe",
    alias: [],
    phone: null,
    smsOptOut: false,
  },
  ceste: [
    {
      _id: "cesta-17",
      numero: 17,
      codice: "400-R-017",
      portata: 400,
      state: "disponibile",
      cliente: null,
    },
  ],
  notKept: ["signature"],
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  backend.record.mockReset();
  backend.uploadUrl.mockReset();
  localStorage.clear();
  localStorage.setItem("pendolino.ritiro", JSON.stringify(saved));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

function button(text: string) {
  const found = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

function Page({ visible = true }: { visible?: boolean }) {
  return (
    <RitiroProvider>
      {visible ? <RitiroFlow /> : <p>Another page</p>}
    </RitiroProvider>
  );
}

test("offers before restoring, freezes edits during recording and starts another Ritiro cleanly", async () => {
  let complete!: () => void;
  backend.record.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () =>
    root.render(
      <StrictMode>
        <Page />
      </StrictMode>,
    ),
  );
  expect(container.textContent).toContain("Un Ritiro lasciato a metà");
  expect(container.textContent).not.toContain("Cambia Cliente");
  expect(JSON.parse(localStorage.getItem("pendolino.ritiro")!)).toEqual(saved);
  await act(async () => button("Riprendi il Ritiro").click());
  expect(container.textContent).toContain("Il telefono non conserva la firma");
  await act(async () => button("Conferma Ritiro").click());
  expect(container.querySelector("fieldset")?.disabled).toBe(true);
  expect(button("Un attimo").disabled).toBe(true);
  expect(localStorage.getItem("pendolino.ritiro")).not.toBeNull();
  await act(async () => complete());
  expect(container.textContent).toContain("Ritiro registrato");
  expect(localStorage.getItem("pendolino.ritiro")).toBeNull();
  expect(backend.record).toHaveBeenCalledExactlyOnceWith({
    clienteId: "giuseppe",
    cesteIds: ["cesta-17"],
    campagnaId: undefined,
    signatureId: undefined,
    photoId: undefined,
  });
  await act(async () => button("Nuovo Ritiro").click());
  expect(container.textContent).not.toContain("Giuseppe");
  expect(container.textContent).not.toContain("Il telefono non conserva");
  expect(localStorage.getItem("pendolino.ritiro")).toBeNull();
});

test("declining the offer removes the draft without recording", async () => {
  await act(async () => root.render(<Page />));
  await act(async () => button("Ricomincia da capo").click());
  expect(container.textContent).not.toContain("Un Ritiro lasciato a metà");
  expect(container.textContent).not.toContain("Giuseppe");
  expect(localStorage.getItem("pendolino.ritiro")).toBeNull();
  expect(backend.record).not.toHaveBeenCalled();
});

test("leaving and returning during recording rejoins the same frozen Ritiro", async () => {
  let complete!: () => void;
  backend.record.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => root.render(<Page />));
  await act(async () => button("Riprendi il Ritiro").click());
  await act(async () => button("Conferma Ritiro").click());
  await act(async () => root.render(<Page visible={false} />));
  await act(async () => root.render(<Page />));
  expect(container.textContent).not.toContain("Un Ritiro lasciato a metà");
  expect(container.querySelector("fieldset")?.disabled).toBe(true);
  expect(button("Un attimo").disabled).toBe(true);
  await act(async () => complete());
  expect(container.textContent).toContain("Ritiro registrato");
  expect(backend.record).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("pendolino.ritiro")).toBeNull();
});

test("leaving an unfinished Ritiro offers the draft again on return", async () => {
  await act(async () => root.render(<Page />));
  await act(async () => button("Riprendi il Ritiro").click());
  await act(async () => root.render(<Page visible={false} />));
  await act(async () => root.render(<Page />));
  expect(container.textContent).toContain("Un Ritiro lasciato a metà");
  expect(container.textContent).not.toContain("Cambia Cliente");
});

test("recording failure while away preserves a draft to offer on return", async () => {
  let fail!: (error: Error) => void;
  backend.record.mockImplementation(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
  );
  await act(async () => root.render(<Page />));
  await act(async () => button("Riprendi il Ritiro").click());
  await act(async () => button("Conferma Ritiro").click());
  await act(async () => root.render(<Page visible={false} />));
  await act(async () => fail(new Error("recording failed")));
  await act(async () => root.render(<Page />));
  expect(container.textContent).toContain("Un Ritiro lasciato a metà");
  expect(localStorage.getItem("pendolino.ritiro")).not.toBeNull();
});
