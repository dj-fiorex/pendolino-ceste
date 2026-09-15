// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import { CestaReader } from "./cesta-reader";

const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useConvex: () => ({ query }) }));
vi.mock("@/components/scanner", () => ({ Scanner: () => null }));

let container: HTMLDivElement;
let root: Root;
const onCesta = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  query.mockReset();
  onCesta.mockReset().mockReturnValue(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (button) =>
      button.getAttribute("aria-label") === label ||
      button.textContent === label,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

async function open(submitLabel = "Aggiungi") {
  await act(async () => {
    root.render(
      <CestaReader
        label="Numero della Cesta"
        submitLabel={submitLabel}
        codici={[]}
        onCesta={onCesta}
      />,
    );
  });
  await click("Numero");
}

test("manual entry opens a modal without an editable input and resets on close", async () => {
  await open();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(
    document.querySelector("input, textarea, [contenteditable=true]"),
  ).toBeNull();
  await click("1");
  await click("Chiudi");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await click("Numero");
  expect(
    document.querySelector<HTMLButtonElement>('[aria-label="Aggiungi"]')!
      .disabled,
  ).toBe(true);
});

test("an unknown numero is reported inside the modal without adding a cesta", async () => {
  query.mockResolvedValue(null);
  await open("Cerca");
  await click("1");
  await click("7");
  await click("Cerca");
  expect(query).toHaveBeenCalledWith(api.ceste.byNumero, { numero: "17" });
  expect(onCesta).not.toHaveBeenCalled();
  expect(
    document.querySelector('[role="dialog"] [role="alert"]')?.textContent,
  ).toBe("Nessuna Cesta con il numero 17.");
});

test.each([
  "400-R-017 è già nell'elenco.",
  "400-R-017 è già spuntata.",
  "400-R-017 risulta Disponibile: rientra lo stesso, con una Rettifica.",
])("keeps the flow feedback visible in the keypad: %s", async (notice) => {
  const cesta = { numero: 17, codice: "400-R-017" };
  query.mockResolvedValue(cesta);
  onCesta.mockReturnValue(notice);
  await open();
  await click("1");
  await click("7");
  await click("Aggiungi");
  expect(onCesta).toHaveBeenCalledExactlyOnceWith(cesta);
  expect(
    document.querySelector('[role="dialog"] [role="alert"]')?.textContent,
  ).toBe(notice);
});
