import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add CORS headers for WebSocket connections
  if (request.headers.get("upgrade") === "websocket") {
    response.headers.set("Upgrade", "websocket");
    response.headers.set("Connection", "Upgrade");
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  return response;
}

export const config = {
  matcher: "/api/socket",
};
