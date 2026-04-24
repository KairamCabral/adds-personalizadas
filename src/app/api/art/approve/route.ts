import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, approved, approver_name, feedback, approved_artwork_id, adjusted_artwork_id } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token é obrigatório" },
        { status: 400 }
      );
    }
    if (typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "Decisão inválida" },
        { status: 400 }
      );
    }
    if (!approver_name || typeof approver_name !== "string" || !approver_name.trim()) {
      return NextResponse.json(
        { error: "Nome do aprovador é obrigatório" },
        { status: 400 }
      );
    }
    if (!approved && (!feedback || typeof feedback !== "string" || feedback.trim().length < 10)) {
      return NextResponse.json(
        { error: "Descreva o ajuste necessário (mínimo 10 caracteres)" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: tokenRow } = await supabase
      .from("approval_tokens")
      .select("id, order_id, artwork_id, used_at, expires_at")
      .eq("token", token)
      .single();

    if (!tokenRow) {
      return NextResponse.json(
        { error: "Link inválido ou não encontrado" },
        { status: 404 }
      );
    }
    if (tokenRow.used_at) {
      return NextResponse.json(
        { error: "Este link já foi utilizado" },
        { status: 400 }
      );
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Este link expirou" },
        { status: 400 }
      );
    }

    // For approval: use approved_artwork_id if provided (specific variation chosen)
    // For revision: use adjusted_artwork_id if provided (specific variation to adjust), else token's artwork
    const targetArtworkId = approved
      ? (approved_artwork_id ?? tokenRow.artwork_id)
      : (adjusted_artwork_id ?? tokenRow.artwork_id);

    const { data: artwork } = await supabase
      .from("artworks")
      .select("id, version, order_id")
      .eq("id", targetArtworkId)
      .single();

    if (!artwork) {
      return NextResponse.json(
        { error: "Arte não encontrada" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (approved) {
      await supabase.from("approval_tokens").update({
        used_at: now,
        used_by_name: approver_name.trim(),
      }).eq("id", tokenRow.id);

      await supabase.from("artworks").update({
        status: "APROVADA",
        approved_by: approver_name.trim(),
        approved_at: now,
        adjustment_notes: null,
      }).eq("id", targetArtworkId);

      const { data: allInVersion } = await supabase
        .from("artworks")
        .select("id")
        .eq("order_id", artwork.order_id)
        .eq("version", artwork.version);

      const toDiscard = (allInVersion ?? []).filter((a) => a.id !== targetArtworkId);
      for (const a of toDiscard) {
        await supabase.from("artworks").update({ status: "DESCARTADA" }).eq("id", a.id);
      }

      const { count: confirmacaoCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "CONFIRMACAO")
        .is("archived_at", null);

      const { error: moveConfErr } = await (supabase.rpc as any)("move_order_atomic", {
        p_order_id: tokenRow.order_id,
        p_new_status: "CONFIRMACAO",
        p_new_position: confirmacaoCount ?? 0,
      });
      if (moveConfErr) throw moveConfErr;

      await supabase.from("order_history").insert({
        order_id: tokenRow.order_id,
        user_id: null,
        action: "artwork_approved",
        new_value: `Arte v${artwork.version} aprovada por ${approver_name.trim()}`,
      });

      const { data: order } = await supabase
        .from("orders")
        .select("created_by, assigned_to")
        .eq("id", tokenRow.order_id)
        .single();

      const uniqueIds = [...new Set([order?.created_by, order?.assigned_to].filter((id): id is string => !!id))];

      for (const userId of uniqueIds) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "artwork_approved",
          title: "Arte aprovada",
          message: `Arte v${artwork.version} do pedido foi aprovada por ${approver_name.trim()}`,
          data: { order_id: tokenRow.order_id, artwork_id: targetArtworkId },
        });
      }
    } else {
      const feedbackText = (feedback ?? "").trim();

      await supabase.from("approval_tokens").update({
        used_at: now,
        used_by_name: approver_name.trim(),
      }).eq("id", tokenRow.id);

      const { data: tokenArtwork } = await supabase
        .from("artworks")
        .select("order_id, version")
        .eq("id", tokenRow.artwork_id)
        .single();

      if (tokenArtwork) {
        if (adjusted_artwork_id) {
          // Specific variation adjustment: update only that artwork
          await supabase
            .from("artworks")
            .update({ status: "AJUSTE_SOLICITADO", adjustment_notes: feedbackText })
            .eq("id", adjusted_artwork_id);
        } else {
          // Global adjustment: update all artworks of the same version (existing behaviour)
          await supabase
            .from("artworks")
            .update({ status: "AJUSTE_SOLICITADO", adjustment_notes: feedbackText })
            .eq("order_id", tokenArtwork.order_id)
            .eq("version", tokenArtwork.version);
        }
      }

      const { count: ajusteCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "AJUSTE")
        .is("archived_at", null);

      const { error: moveAjusteErr } = await (supabase.rpc as any)("move_order_atomic", {
        p_order_id: tokenRow.order_id,
        p_new_status: "AJUSTE",
        p_new_position: ajusteCount ?? 0,
      });
      if (moveAjusteErr) throw moveAjusteErr;

      const revVersion = tokenArtwork?.version ?? artwork.version;
      await supabase.from("order_history").insert({
        order_id: tokenRow.order_id,
        user_id: null,
        action: "artwork_revision_requested",
        new_value: `Ajuste solicitado na arte v${revVersion} por ${approver_name.trim()}: ${feedbackText}`,
      });

      const { data: order } = await supabase
        .from("orders")
        .select("created_by, assigned_to")
        .eq("id", tokenRow.order_id)
        .single();

      const uniqueIds = [...new Set([order?.created_by, order?.assigned_to].filter((id): id is string => !!id))];

      for (const userId of uniqueIds) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "artwork_adjustment",
          title: "Ajuste solicitado na arte",
          message: `${approver_name.trim()} solicitou ajuste na arte v${revVersion}: ${feedbackText.slice(0, 80)}${feedbackText.length > 80 ? "…" : ""}`,
          data: { order_id: tokenRow.order_id, artwork_id: tokenRow.artwork_id },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Art approval error:", err);
    return NextResponse.json(
      { error: "Erro ao processar decisão" },
      { status: 500 }
    );
  }
}
