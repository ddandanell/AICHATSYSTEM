import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [/^\/login\/?$/, /^\/api\/auth(\/|$)/];

function hasSession(request: NextRequest) {
  return Boolean(
    request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value,
  );
}

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) {
    const lower = key.toLowerCase();
    if (
      lower.startsWith("x-tenant-") ||
      lower === "x-org-id" ||
      lower === "x-workspace" ||
      lower === "x-org-role"
    ) {
      headers.delete(key);
    }
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
  if (!isPublic && !hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
