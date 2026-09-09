// @vitest-environment node
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "./app-shell";
import { RegistroList } from "./registro-list";
import { SmsHistory } from "./sms-history";

const session = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: true,
  pathname: "/registro",
  query: vi.fn(),
  redirect: vi.fn((url: string): never => {
    throw new Error(`Redirect to ${url}`);
  }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => session,
  useQuery: (...args: unknown[]) => session.query(...args),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => session.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  redirect: session.redirect,
}));

const clienteId = "cliente-test" as Id<"clienti">;
const renderProtected = () =>
  renderToString(
    <AppShell>
      <RegistroList initialDay="2026-09-09" />
      <SmsHistory clienteId={clienteId} />
    </AppShell>,
  );

beforeEach(() => {
  session.isAuthenticated = false;
  session.isLoading = true;
  session.pathname = "/registro";
  session.redirect.mockClear();
  session.query.mockReset();
  session.query.mockImplementation((query, args) => {
    if (args === "skip") return undefined;
    if (!session.isAuthenticated) {
      throw new Error("No session on this device: nobody is signed in.");
    }
    if (getFunctionName(query) === getFunctionName(api.operatori.current)) {
      return { name: "Gabriele", role: "admin" };
    }
    return [];
  });
});

test("neither the chrome nor protected screens query while auth is loading", () => {
  expect(renderProtected()).toContain("Un attimo…");
  expect(session.query).not.toHaveBeenCalled();
  expect(session.redirect).not.toHaveBeenCalled();
});

test("confirmed auth mounts the chrome and screens using ordinary queries", () => {
  session.isLoading = false;
  session.isAuthenticated = true;

  expect(renderProtected()).toContain("Gabriele");
  expect(session.query).toHaveBeenCalledWith(api.operatori.current, {});
  expect(session.query).toHaveBeenCalledWith(api.campagne.list, {});
  expect(session.query).toHaveBeenCalledWith(api.registro.filterOptions, {
    day: { from: expect.any(Number), to: expect.any(Number) },
  });
  expect(session.query).toHaveBeenCalledWith(api.registro.list, {
    day: { from: expect.any(Number), to: expect.any(Number) },
    clienteId: undefined,
    operatoreId: undefined,
  });
  expect(session.query).toHaveBeenCalledWith(api.sms.byCliente, { clienteId });
});

test("a signed-out browser redirects before rendering protected queries", () => {
  session.isLoading = false;
  expect(renderProtected).toThrow("Redirect to /accedi");
  expect(session.query).not.toHaveBeenCalled();
});

test("losing authentication blocks protected children on the next render", () => {
  session.isLoading = false;
  session.isAuthenticated = true;
  renderProtected();

  session.isAuthenticated = false;
  session.query.mockClear();
  expect(renderProtected).toThrow("Redirect to /accedi");
  expect(session.query).not.toHaveBeenCalled();
});

test.each(["/accedi", "/password/invitation-token"])(
  "%s stays accessible during auth loading and after sign-out",
  (pathname) => {
    session.pathname = pathname;
    const render = () =>
      renderToString(
        <AppShell>
          <p>Accesso</p>
        </AppShell>,
      );
    expect(render()).toBe("<p>Accesso</p>");
    session.isLoading = false;
    expect(render()).toBe("<p>Accesso</p>");
    expect(session.query).not.toHaveBeenCalled();
    expect(session.redirect).not.toHaveBeenCalled();
  },
);

test("the password page can query a public access link without a session", () => {
  session.pathname = "/password/invitation-token";
  session.isLoading = false;
  session.query.mockReturnValue(null);
  function PublicContent() {
    useQuery(api.accessLinks.byToken, { token: "invitation-token" });
    return <p>Invito</p>;
  }
  expect(
    renderToString(
      <AppShell>
        <PublicContent />
      </AppShell>,
    ),
  ).toContain("Invito");
  expect(session.query).toHaveBeenCalledWith(api.accessLinks.byToken, {
    token: "invitation-token",
  });
});

test("an authenticated account without an operator can still see its home message", () => {
  session.pathname = "/";
  session.isLoading = false;
  session.isAuthenticated = true;
  session.query.mockReturnValue(null);
  expect(
    renderToString(
      <AppShell>
        <p>Questo account non è abilitato</p>
      </AppShell>,
    ),
  ).toBe("<p>Questo account non è abilitato</p>");
  expect(session.redirect).not.toHaveBeenCalled();
});
