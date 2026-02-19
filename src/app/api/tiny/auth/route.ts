import { NextResponse } from "next/server";
import { getTinyAuthUrl } from "@/lib/tiny-api";

export async function GET() {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/tiny/callback`;
  const authUrl = getTinyAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
