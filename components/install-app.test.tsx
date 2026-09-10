// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { InstallApp } from "./install-app";
import { PwaProvider } from "./pwa-provider";

vi.mock("@serwist/next/react", () => ({
  SerwistProvider: ({ children }: { children: ReactNode }) => children,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(showAction = true) {
  await act(() =>
    root.render(<PwaProvider>{showAction && <InstallApp />}</PwaProvider>),
  );
}

async function clickInstall() {
  const button = container.querySelector("button");
  expect(button).not.toBeNull();
  await act(() => button!.click());
}

test("retains an install event received before Altro opens and consumes it once", async () => {
  await render(false);
  const prompt = vi.fn().mockResolvedValue({ outcome: "dismissed" });
  const event = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    { prompt },
  );
  await act(() => {
    window.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);

  await render();
  expect(prompt).not.toHaveBeenCalled();
  await clickInstall();
  expect(prompt).toHaveBeenCalledOnce();
  await clickInstall();
  expect(prompt).toHaveBeenCalledOnce();
  expect(document.body.textContent).toContain("Apri il menu del browser");
});

test("iPad in desktop mode receives Home Screen instructions", async () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  vi.spyOn(navigator, "maxTouchPoints", "get").mockReturnValue(5);
  await render();
  await clickInstall();
  expect(document.body.textContent).toContain("Condividi");
  expect(document.body.textContent).toContain("Aggiungi alla schermata Home");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});

test("a failed browser prompt offers manual installation instead of throwing", async () => {
  await render();
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt: vi.fn().mockRejectedValue(new Error("Prompt unavailable")),
  });
  await act(() => {
    window.dispatchEvent(event);
  });
  await clickInstall();
  expect(document.body.textContent).toContain("Apri il menu del browser");
  expect(container.querySelector("button")?.disabled).toBe(false);
});

test("installation removes the action", async () => {
  await render();
  expect(container.textContent).toContain("Installa Pendolino");
  await act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
  expect(container.querySelector("button")).toBeNull();
});

test("an iOS standalone launch never offers installation", async () => {
  Object.defineProperty(navigator, "standalone", {
    configurable: true,
    value: true,
  });
  try {
    await render();
    expect(container.querySelector("button")).toBeNull();
  } finally {
    Reflect.deleteProperty(navigator, "standalone");
  }
});
