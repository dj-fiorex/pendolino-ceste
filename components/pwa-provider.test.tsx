// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  InstallButton,
  PwaProvider,
  useMovementActivity,
} from "./pwa-provider";

const connection = vi.hoisted(() => ({
  isWebSocketConnected: true,
  hasEverConnected: true,
  connectionRetries: 0,
  inflightMutations: 0,
  inflightActions: 0,
}));
vi.mock("convex/react", () => ({ useConvexConnectionState: () => connection }));

let root: Root;
let host: HTMLDivElement;
let serviceWorkers: EventTarget & { register: ReturnType<typeof vi.fn> };
let worker: EventTarget & {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
};
let reload: ReturnType<typeof vi.spyOn>;

function Work({
  dirty,
  pending,
  recoverable,
}: {
  dirty: boolean;
  pending: boolean;
  recoverable: boolean;
}) {
  useMovementActivity(dirty, pending, recoverable);
  return <InstallButton />;
}
async function show(dirty = false, pending = false, recoverable = true) {
  await act(async () =>
    root.render(
      <PwaProvider>
        <Work dirty={dirty} pending={pending} recoverable={recoverable} />
      </PwaProvider>,
    ),
  );
}
function findButton(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === label,
  );
  if (!button)
    throw new Error(`Missing ${label}: ${document.body.textContent}`);
  return button;
}
async function click(label: string) {
  await act(async () => findButton(label).click());
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  connection.isWebSocketConnected = true;
  worker = Object.assign(new EventTarget(), {
    state: "installed",
    postMessage: vi.fn(),
  });
  const registration = Object.assign(new EventTarget(), {
    waiting: worker,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  serviceWorkers = Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue(registration),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorkers,
  });
  reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

test("a waiting update never reloads unfinished work without an explicit choice", async () => {
  await show(true);
  expect(reload).not.toHaveBeenCalled();
  expect(worker.postMessage).not.toHaveBeenCalled();
  await click("Aggiorna");
  expect(document.body.textContent).toContain(
    "Foto e firma vanno acquisite di nuovo",
  );
  await click("Continua a lavorare");
  expect(worker.postMessage).not.toHaveBeenCalled();
  await click("Aggiorna");
  await click("Aggiorna e ricarica");
  expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({
    type: "APPLY_UPDATE",
  });
  await act(async () =>
    serviceWorkers.dispatchEvent(new Event("controllerchange")),
  );
  expect(reload).toHaveBeenCalledOnce();
});

test("a different tab activating an update cannot reload this tab", async () => {
  await show(true);
  await act(async () =>
    serviceWorkers.dispatchEvent(new Event("controllerchange")),
  );
  expect(reload).not.toHaveBeenCalled();
});

test("pending confirmations and failed draft persistence disable updates", async () => {
  await show(true, true);
  expect(findButton("Aggiorna").disabled).toBe(true);
  await show(true, false, false);
  expect(findButton("Aggiorna").disabled).toBe(true);
  await show(false);
  expect(findButton("Aggiorna").disabled).toBe(false);
});

test("connection loss warns without unmounting the current work", async () => {
  await show(true);
  connection.isWebSocketConnected = false;
  await show(true);
  expect(document.body.textContent).toContain("Connessione assente");
  expect(findButton("Installa Pendolino")).toBeDefined();
});

test("native installation is user-triggered and the install entry disappears after installation", async () => {
  await show();
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) },
  );
  await act(async () => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(prompt).not.toHaveBeenCalled();
  await click("Installa Pendolino");
  await click("Installa");
  expect(prompt).toHaveBeenCalledOnce();
  await act(async () => window.dispatchEvent(new Event("appinstalled")));
  expect(host.textContent).not.toContain("Installa Pendolino");
});
