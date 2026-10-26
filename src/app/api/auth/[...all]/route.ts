import { auth } from "@/lib/auth";
import { isAllowedAuthEndpointInDemo, isDemoMode } from "@/lib/demo";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

function guard(method: "GET" | "POST", next: (request: Request) => Promise<Response>) {
  return (request: Request) => {
    if (isDemoMode() && !isAllowedAuthEndpointInDemo(method, new URL(request.url).pathname)) {
      return Promise.resolve(
        Response.json(
          { message: "This endpoint is disabled in the public demo." },
          { status: 403 },
        ),
      );
    }

    return next(request);
  };
}

export const GET = guard("GET", handler.GET);
export const POST = guard("POST", handler.POST);
