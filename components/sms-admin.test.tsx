// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SmsAdmin } from "./sms-admin";

// The Convex subscriptions are the external boundary: the mill's settings
// come back as stored, and nothing has been sent yet. The preview is what is
// under test, and it is rendered from those and the Admin's own choice.
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (query: unknown) => {
    switch (getFunctionName(query as never)) {
      case "sms:settings":
        return {
          smsRitiroTemplate:
            "Ha ritirato le ceste {{numeri}}, cioè {{ceste}}. In tutto ha {{totale}} da riportare.",
          smsRitiroOn: true,
          smsRientroTemplate:
            "Ha riportato le ceste {{numeri}}, cioè {{ceste}}. Da riportare: {{totale}}.",
          smsRientroOn: true,
        };
      case "frantoio:settings":
        return { millName: "Frantoio", millPhone: "", smsSender: "Frantoio" };
      case "campagne:list":
        return [];
      case "sms:list":
        return { count: 0, segments: 0, rows: [] };
      default:
        throw new Error(`Unexpected query ${String(query)}`);
    }
  },
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<SmsAdmin />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/** The preview under one editor, after picking the scenario with this label. */
async function previewFor(editor: string, scenario: string): Promise<string> {
  const select = container.querySelector<HTMLSelectElement>(`#${editor}-prova`);
  if (select === null) {
    throw new Error(`No scenario picker under ${editor}`);
  }
  const option = [...select.options].find((o) => o.text === scenario);
  if (option === undefined) {
    throw new Error(`No scenario "${scenario}" under ${editor}`);
  }
  await act(async () => {
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const preview = select.parentElement?.querySelector("p.whitespace-pre-wrap");
  return preview?.textContent ?? "";
}

// The three counts are told apart on purpose: a preview where {{ceste}} and
// {{totale}} read the same is how a mill came to write one for the other.
test("a Ritiro on top of Ceste already out shows the two counts apart", async () => {
  expect(await previewFor("sms-ritiro", "Ritira 4 Ceste, ne aveva già 2")).toBe(
    "Ha ritirato le ceste 17, 22, 34, 41, cioè 4 ceste. In tutto ha 6 ceste da riportare.",
  );
});

test("a Ritiro lists as many numbers as it counts", async () => {
  expect(await previewFor("sms-ritiro", "Ritira 3 Ceste e non ne aveva")).toBe(
    "Ha ritirato le ceste 17, 22, 34, cioè 3 ceste. In tutto ha 3 ceste da riportare.",
  );
  expect(await previewFor("sms-ritiro", "Ritira una Cesta sola")).toBe(
    "Ha ritirato le ceste 17, cioè 1 cesta. In tutto ha 1 cesta da riportare.",
  );
});

test("a partial Rientro leaves some out, and a full one leaves none", async () => {
  expect(
    await previewFor("sms-rientro", "Riporta 2 Ceste, gliene restano 3"),
  ).toBe("Ha riportato le ceste 17, 22, cioè 2 ceste. Da riportare: 3 ceste.");
  expect(await previewFor("sms-rientro", "Riporta l'ultima che aveva")).toBe(
    "Ha riportato le ceste 17, cioè 1 cesta. Da riportare: nessuna cesta.",
  );
  expect(
    await previewFor("sms-rientro", "Riporta tutte e 3 quelle che aveva"),
  ).toBe(
    "Ha riportato le ceste 17, 22, 34, cioè 3 ceste. Da riportare: nessuna cesta.",
  );
});

test("the placeholders are explained beside the template", () => {
  expect(container.textContent).toContain("{{totale}}");
  expect(container.textContent).toContain("Quelle che gli restano Fuori dopo");
});
