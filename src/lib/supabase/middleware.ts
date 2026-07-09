import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes — allow access (sem autenticação)
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/quote") ||
    pathname.startsWith("/supplier") ||
    pathname.startsWith("/art/approve") ||
    pathname.startsWith("/api/art/approve") ||
    pathname.startsWith("/nps/") || // página pública de resposta NPS (/nps/<token>)
    pathname.startsWith("/api/nps/respond") || // submissão pública da resposta NPS
    pathname.startsWith("/congressos/") || // pré-cadastro público do estande (/congressos/<slug>) — a interna /congressos (sem barra) segue protegida
    pathname.startsWith("/api/congressos") || // registro público do pré-cadastro
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/quote") || // /api/quote/submit, /api/quote/upload-logo
    pathname.startsWith("/api/products/public") || // Catálogo público para formulário de orçamento
    pathname.startsWith("/api/clients/find-by-document") || // Busca por CPF/CNPJ no passo "Já sou cliente"
    pathname.startsWith("/api/orders/create-from-app") || // App representantes — auth via Bearer token
    pathname.startsWith("/api/tiny/create-contact"); // App representantes — auth via Bearer token

  if (isPublicRoute) {
    // Redirect authenticated users away from login
    if (user && pathname.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/pipeline";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Protected routes — redirect to login if not authenticated
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
