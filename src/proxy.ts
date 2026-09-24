import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { supabaseConfig } from "@/lib/supabase/config";
import { sessionCookieOptions } from "@/lib/supabase/cookie-policy";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/chat",
  "/mail",
  "/tenders",
  "/procurement-plans",
  "/upcoming-deadlines",
  "/external-sources",
  "/partners",
  "/reviews",
  "/renewals",
  "/templates",
  "/lessons",
  "/team",
  "/whatsapp",
  "/kanban",
  "/tender-pipeline",
];

// Specific route access matrix by role
const ROLE_ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/dashboard/users": ["super_admin"],
  "/dashboard/roles": ["super_admin"],
  "/dashboard/settings": ["super_admin"],
  "/dashboard/checklist-templates": ["super_admin", "country_admin"],
  "/dashboard/reviews": ["super_admin", "country_admin", "hod", "committee", "technical_review", "account_manager"],
  "/dashboard/renewals": ["super_admin", "country_admin"],
  "/dashboard/external-sources": ["super_admin", "country_admin"],
  "/dashboard/lessons": ["super_admin", "country_admin", "hod", "committee", "account_manager"],
  "/dashboard/procurement-plans": ["super_admin", "country_admin", "hod", "account_manager"],
  "/dashboard/partners": ["super_admin", "country_admin", "hod", "account_manager"],
};

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(supabaseConfig().url, supabaseConfig().key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) req.cookies.set(name, value);
        response = NextResponse.next({ request: req });
        for (const { name, value, options } of values)
          response.cookies.set(
            name,
            value,
            sessionCookieOptions(options, req.cookies.get("atcis_remember")?.value === "1"),
          );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;
  const profile = user
    ? (await supabase.from("profiles").select("role").eq("id", user.id).eq("active", true).maybeSingle()).data
    : null;
  function redirect(path: string) {
    const result = NextResponse.redirect(new URL(path, req.url));
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
    return result;
  }
function isValidOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (hostHeader && originUrl.host.toLowerCase() === hostHeader.toLowerCase()) {
      return true;
    }
    if (origin === req.nextUrl.origin) {
      return true;
    }
    const isLocalHost = (h: string) =>
      h.startsWith("localhost:") ||
      h === "localhost" ||
      h.startsWith("127.0.0.1:") ||
      h === "127.0.0.1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(h);
    if (isLocalHost(originUrl.host) && hostHeader && isLocalHost(hostHeader)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/tenders/analyze") || pathname.startsWith("/api/crm/zoho")) {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        if (!isValidOrigin(req)) {
          return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
        }
      }
      return response;
    }
    if (!profile) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!isValidOrigin(req)) {
        return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
      }
    }
    return response;
  }
  if (pathname === "/") return redirect(profile ? "/dashboard/default" : "/auth/v2/login");
  if (pathname.startsWith("/auth/") || pathname === "/login")
    return profile ? redirect("/dashboard/default") : response;
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!profile) return redirect(`/auth/v2/login?redirect=${encodeURIComponent(pathname + req.nextUrl.search)}`);
    for (const [prefix, roles] of Object.entries(ROLE_ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(prefix) && !roles.includes(profile.role))
        return redirect("/dashboard/default?unauthorized=true");
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
