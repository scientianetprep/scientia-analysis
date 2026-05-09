import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/pending",
  "/verify-mfa",
  "/setup-mfa",
  "/forgot-password",
  "/auth/callback",
  "/api/auth/",
  "/api/support",
  "/_next/",
  "/favicon.ico",
];

const ADMIN_ROLES = ["admin", "super_admin", "examiner"];

/**
 * Layer 1 Security: Middleware Proxy
 * Implements Ghost Mode for /admin routes and session verification.
 * Returns 403 JSON for API routes, redirects for browser routes.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });
  const forceStudentView = request.cookies.get("force_student_view")?.value === "1";

  // 1. Setup Supabase Client for Middleware (using request.cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 2. Cryptographically verify user
  const { data: { user } } = await supabase.auth.getUser();

  // Determine if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  );

  // 3. Ghost Mode & Admin Protection (minimal check - let layout handle full auth)
  // Just check if logged in - full role/MFA checks happen in layout to avoid RLS issues
  const isAdminRoute = pathname.startsWith("/admin");
  const isApiRoute = pathname.startsWith("/api/");

  if (isAdminRoute) {
    if (!user) {
      return isApiRoute
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 4. Public Route logic (Redirect logged-in users away from auth pages)
  if (isPublicRoute) {
    if (user && (pathname === "/login" || pathname === "/register")) {
      const url = new URL(request.url);
      if (pathname === "/register" && url.searchParams.get("resume")) {
        return response;
      }

      // Route admins to /admin by default unless they explicitly forced student view.
      if (!forceStudentView) {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (accessToken) {
          try {
            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            const role = payload?.custom_claims?.role;
            if (ADMIN_ROLES.includes(role)) {
              return NextResponse.redirect(new URL("/admin", request.url));
            }
          } catch {
            // Ignore malformed token and fall back to student dashboard.
          }
        }
      }

      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // 5. Protected Route logic
  if (!user) {
    return isApiRoute
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};