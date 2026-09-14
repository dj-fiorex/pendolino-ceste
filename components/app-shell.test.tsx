// @vitest-environment happy-dom
import { useQuery, type Preloaded } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import { AppShell } from "./app-shell";
import { ConvexAuthGate } from "./convex-auth-gate";

const session = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: true,
  pathname: "/",
  query: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`Redirect to ${url}`);
  }),
}));

// Keep the real Better Auth preloading hook: its effects preserve SSR data
// during reconfirmation and defer subscriptions until Convex authenticates.
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useConvexAuth: () => session,
  useQuery: (...args: unknown[]) => session.query(...args),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => session.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  redirect: session.redirect,
}));

const operatore = {
  name: "Gabriele",
  email: "gabriele@example.test",
  role: "admin",
};
// Convex 1.45 types these JSON values as strings, but preloadQuery returns objects.
const preloadedOperatore = {
  _name: getFunctionName(api.operatori.current),
  _argsJSON: {},
  _valueJSON: operatore,
} as unknown as Preloaded<typeof api.operatori.current>;
const preloadedCampagne = {
  _name: getFunctionName(api.campagne.list),
  _argsJSON: {},
  _valueJSON: [
    {
      _id: "campagna-test",
      _creationTime: 0,
      name: "2026",
      openedAt: 0,
      closedAt: null,
    },
  ],
} as unknown as Preloaded<typeof api.campagne.list>;
let container: HTMLDivElement;
let root: Root;
let mounts = 0;
let unmounts = 0;
function Banco() {
  useEffect(() => {
    mounts++;
    return () => {
      unmounts++;
    };
  }, []);
  return <main>Banco con dati server</main>;
}
const banco = () => (
  <AppShell
    preloadedOperatore={preloadedOperatore}
    preloadedCampagne={preloadedCampagne}
  >
    <Banco />
  </AppShell>
);
const renderBanco = async () => {
  await act(async () => {
    root.render(banco());
  });
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  session.isAuthenticated = false;
  session.isLoading = true;
  session.pathname = "/";
  session.redirect.mockClear();
  session.query.mockReset();
  session.query.mockImplementation((query, args) => {
    if (args === "skip") return undefined;
    if (!session.isAuthenticated)
      throw new Error("Query before authentication");
    return getFunctionName(query) === preloadedOperatore._name
      ? operatore
      : preloadedCampagne._valueJSON;
  });
  mounts = 0;
  unmounts = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("SSR includes the banco, operator and campaign before browser authentication", () => {
  const html = renderToString(banco());
  expect(html).toContain("Banco con dati server");
  expect(html).toContain("Gabriele");
  expect(html).toContain("Campagna aperta:");
  expect(html).not.toContain("Un attimo");
  expect(session.query.mock.calls.every(([, args]) => args === "skip")).toBe(
    true,
  );
});

test("initial loading, authenticated, reconfirming, authenticated never unmounts the banco", async () => {
  for (const authenticated of [false, true, false, true]) {
    session.isAuthenticated = authenticated;
    session.isLoading = !authenticated;
    session.query.mockClear();
    await renderBanco();
    expect(container.textContent).toContain("Banco con dati server");
    expect(container.textContent).toContain("Gabriele");
    expect(container.textContent).toContain("Campagna aperta: 2026");
    expect(container.textContent).not.toContain("Un attimo");
    if (!authenticated)
      expect(
        session.query.mock.calls.every(([, args]) => args === "skip"),
      ).toBe(true);
  }
  expect(mounts).toBe(1);
  expect(unmounts).toBe(0);
});

test("interactive screens issue no queries until Convex confirms authentication", () => {
  function Interactive() {
    useQuery(api.registro.list, {});
    return <p>Registro</p>;
  }
  const render = () =>
    renderToString(
      <ConvexAuthGate>
        <Interactive />
      </ConvexAuthGate>,
    );
  expect(render()).toContain("Un attimo");
  expect(session.query).not.toHaveBeenCalled();
  session.isAuthenticated = true;
  session.isLoading = false;
  expect(render()).toContain("Registro");
  expect(session.query).toHaveBeenCalled();
  session.query.mockClear();
  session.isAuthenticated = false;
  session.isLoading = true;
  expect(render()).toContain("Un attimo");
  expect(session.query).not.toHaveBeenCalled();
});

test("confirmed sign-out redirects before reading preloaded or live data", () => {
  session.isLoading = false;
  expect(() => renderToString(banco())).toThrow("Redirect to /accedi");
  expect(session.query).not.toHaveBeenCalled();
  expect(() =>
    renderToString(
      <ConvexAuthGate>
        <Banco />
      </ConvexAuthGate>,
    ),
  ).toThrow("Redirect to /accedi");
});

test("a deactivated operator replaces the banco and navigation with the disabled message", async () => {
  session.isLoading = false;
  session.isAuthenticated = true;
  await renderBanco();
  session.query.mockImplementation((query, args) =>
    args === "skip"
      ? undefined
      : getFunctionName(query) === preloadedOperatore._name
        ? null
        : [],
  );
  await renderBanco();
  expect(container.textContent).toContain("Questo account non è abilitato");
  expect(container.textContent).not.toContain("Banco con dati server");
  expect(container.querySelector("nav")).toBeNull();
});

test("a disabled account can render on the server without loading campaigns", () => {
  const html = renderToString(
    <AppShell
      preloadedOperatore={
        { ...preloadedOperatore, _valueJSON: null } as unknown as Preloaded<
          typeof api.operatori.current
        >
      }
      preloadedCampagne={null}
    >
      <Banco />
    </AppShell>,
  );
  expect(html).toContain("Questo account non è abilitato");
  expect(html).not.toContain("Banco con dati server");
});

test("reconnection keeps the shell visible until live query results return", async () => {
  session.isLoading = false;
  session.isAuthenticated = true;
  await renderBanco();
  session.isLoading = true;
  session.isAuthenticated = false;
  await renderBanco();
  session.isLoading = false;
  session.isAuthenticated = true;
  session.query.mockReturnValue(undefined);
  await renderBanco();
  expect(container.textContent).toContain("Banco con dati server");
  expect(container.textContent).toContain("Campagna aperta: 2026");
  expect(container.textContent).not.toContain("Questo account non è abilitato");
});
