// @vitest-environment node
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SmsHistory } from "./sms-history";

const session = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: true,
  query: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => session,
  useQuery: (...args: unknown[]) => session.query(...args),
}));

const clienteId = "cliente-test" as Id<"clienti">;
const render = () => renderToString(createElement(SmsHistory, { clienteId }));

beforeEach(() => {
  session.isAuthenticated = false;
  session.isLoading = true;
  session.query.mockReset();
  session.query.mockImplementation((_query, args) => {
    if (args === "skip") return undefined;
    if (!session.isAuthenticated) {
      throw new Error("No Operatore is signed in on this device.");
    }
    return [];
  });
});

test("SMS history waits for browser authentication after the page loads", () => {
  expect(render).not.toThrow();
  expect(session.query).toHaveBeenLastCalledWith(api.sms.byCliente, "skip");

  session.isLoading = false;
  session.isAuthenticated = true;
  expect(render).not.toThrow();
  expect(session.query).toHaveBeenLastCalledWith(api.sms.byCliente, {
    clienteId,
  });

  // Losing the session must also stop the protected subscription.
  session.isAuthenticated = false;
  expect(render).not.toThrow();
  expect(session.query).toHaveBeenLastCalledWith(api.sms.byCliente, "skip");
});

test("a signed-out browser does not request SMS history", () => {
  session.isLoading = false;
  expect(render()).toBe("");
  expect(session.query).toHaveBeenLastCalledWith(api.sms.byCliente, "skip");
});
