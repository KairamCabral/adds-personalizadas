import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QR público do brinde como imagem PNG (para o e-mail de confirmação). Clientes
 * de e-mail como o Gmail bloqueiam data-URI, então servimos por URL HTTPS real.
 * Codifica apenas o `token` do resgate (imprevisível, ≥128 bits) — não revela PII;
 * a leitura pública do brinde continua passando pelo RPC `validate_gift_token`.
 * A allowlist pública do middleware já cobre `/api/congressos`.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // token = encode(gen_random_bytes(32),'hex') → hex; valida forma p/ não gerar
  // QR de conteúdo arbitrário.
  if (!token || !/^[a-f0-9]{16,128}$/i.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const png = await QRCode.toBuffer(token, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    console.error("[congressos/qr]", err);
    return new NextResponse("Erro ao gerar QR", { status: 500 });
  }
}
