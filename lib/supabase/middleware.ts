import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApp =
    path.startsWith("/dashboard") ||
    path.startsWith("/markets") ||
    path.startsWith("/portfolio") ||
    path.startsWith("/settings") ||
    path.startsWith("/admin");
  const isPublicAuth =
    path.startsWith("/sign-in") ||
    path.startsWith("/auth") ||
    path.startsWith("/join") ||
    path.startsWith("/start");

  if (isApp && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/sign-in";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/sign-in") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    return NextResponse.redirect(redirect);
  }

  if (isApp && user?.email && !isPublicAuth) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1);

    const { data: invite } = await supabase
      .from("invites")
      .select("email")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();

    if ((!memberships || memberships.length === 0) && !invite) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/start";
      redirect.searchParams.set("error", "no_company");
      return NextResponse.redirect(redirect);
    }
  }

  return supabaseResponse;
}
