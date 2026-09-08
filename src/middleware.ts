import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protege /dashboard: redirige a /login si no hay sesión.
// Redirige /login y /register a /dashboard si ya hay sesión activa.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const esRutaProtegida = path.startsWith("/dashboard") || path.startsWith("/admin");
  const esRutaAuth = path === "/login" || path === "/register";

  if (!user && esRutaProtegida) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && path.startsWith("/admin")) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (user && esRutaAuth) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
