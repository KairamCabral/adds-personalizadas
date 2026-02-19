import { NextResponse } from "next/server";
import { isTinyConnected } from "@/lib/tiny-api";

export async function GET() {
  const [tiny, resend] = await Promise.all([
    isTinyConnected().catch(() => false),
    Promise.resolve(!!process.env.RESEND_API_KEY),
  ]);

  return NextResponse.json({ tiny, resend });
}
