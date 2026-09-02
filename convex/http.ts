import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Better Auth serves sign-in, sign-out and session refresh from this router
// (ADR-0008).
authComponent.registerRoutes(http, createAuth);

export default http;
