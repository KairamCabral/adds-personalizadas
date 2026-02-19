import { NextResponse } from "next/server";
import { isTinyConnected } from "@/lib/tiny-api";

export async function GET() {
  try {
    const connected = await isTinyConnected();
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
