import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, storeTinyTokens } from "@/lib/tiny-api";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=no_code`
    );
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/tiny/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await storeTinyTokens(tokens);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?tiny=connected`
    );
  } catch (error) {
    console.error("Tiny OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=oauth_failed`
    );
  }
}
