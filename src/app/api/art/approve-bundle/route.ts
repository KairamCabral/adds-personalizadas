import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/art/approve-bundle
// Processes all decisions in a bundle token atomically.
// Body: {
//   token: string
//   approver_name: string
//   decisions: Array<{
//     artwork_id: string
//     approved: boolean
//     feedback?: string   // required when approved = false
//   }>
// }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, approver_name, decisions } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });
    }
    if (!approver_name?.trim()) {
      return NextResponse.json({ error: "Nome do aprovador é obrigatório" }, { status: 400 });
    }
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return NextResponse.json({ error: "Nenhuma decisão fornecida" }, { status: 400 });
    }
    for (const d of decisions) {
      if (!d.artwork_id) {
        return NextResponse.json({ error: "artwork_id é obrigatório em cada decisão" }, { status: 400 });
      }
      if (typeof d.approved !== "boolean") {
        return NextResponse.json({ error: "Decisão inválida" }, { status: 400 });
      }
      if (!d.approved && (!d.feedback?.trim() || d.feedback.trim().length < 10)) {
        return NextResponse.json(
          { error: `Descreva o ajuste para a arte (mínimo 10 caracteres)` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // Validate token
    const { data: tokenRow } = await supabase
      .from("approval_tokens")
      .select("id, order_id, artwork_id, used_at, expires_at, is_bundle")
      .eq("token", token)
      .single();

    if (!tokenRow) {
      return NextResponse.json({ error: "Link inválido ou não encontrado" }, { status: 404 });
    }
    if (!tokenRow.is_bundle) {
      return NextResponse.json({ error: "Este endpoint é exclusivo para links de aprovação em lote" }, { status: 400 });
    }
    if (tokenRow.used_at) {
      return NextResponse.json({ error: "Este link já foi utilizado" }, { status: 400 });
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Este link expirou" }, { status: 400 });
    }

    // Verify all decision artwork_ids belong to this bundle
    const { data: bundleItems } = await supabase
      .from("approval_bundle_items")
      .select("artwork_id")
      .eq("token_id", tokenRow.id);

    const bundleArtworkIds = new Set((bundleItems ?? []).map((i) => i.artwork_id));
    for (const d of decisions) {
      if (!bundleArtworkIds.has(d.artwork_id)) {
        return NextResponse.json(
          { error: `Arte ${d.artwork_id} não pertence a este lote` },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const approverName = approver_name.trim();

    let hasApproval = false;
    let hasRevision = false;
    let versionForHistory = 1;

    // Process each decision
    for (const d of decisions) {
      const { data: artwork } = await supabase
        .from("artworks")
        .select("id, version, order_id")
        .eq("id", d.artwork_id)
        .single();

      if (!artwork) continue;
      versionForHistory = artwork.version;

      if (d.approved) {
        hasApproval = true;
        await supabase.from("artworks").update({
          status: "APROVADA",
          approved_by: approverName,
          approved_at: now,
          adjustment_notes: null,
        }).eq("id", d.artwork_id);
      } else {
        hasRevision = true;
        await supabase.from("artworks").update({
          status: "AJUSTE_SOLICITADO",
          adjustment_notes: d.feedback?.trim() ?? "",
        }).eq("id", d.artwork_id);
      }
    }

    // Mark token as used
    await supabase.from("approval_tokens").update({
      used_at: now,
      used_by_name: approverName,
    }).eq("id", tokenRow.id);

    // Update order status — revision takes priority over approval
    const newOrderStatus = hasRevision ? "AJUSTE" : "CONFIRMACAO";

    const { count: statusCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", newOrderStatus)
      .is("archived_at", null);

    await supabase.from("orders").update({
      status: newOrderStatus,
      position: statusCount ?? 0,
      updated_at: now,
    }).eq("id", tokenRow.order_id);

    // History entry
    const approvedCount = decisions.filter((d) => d.approved).length;
    const revisionCount = decisions.filter((d) => !d.approved).length;
    const historyMsg = [
      approvedCount > 0 ? `${approvedCount} arte(s) aprovada(s)` : null,
      revisionCount > 0 ? `${revisionCount} arte(s) com ajuste solicitado` : null,
    ]
      .filter(Boolean)
      .join(", ");

    await supabase.from("order_history").insert({
      order_id: tokenRow.order_id,
      user_id: null,
      action: hasRevision ? "artwork_revision_requested" : "artwork_approved",
      new_value: `Lote v${versionForHistory} revisado por ${approverName}: ${historyMsg}`,
    });

    // Notifications
    const { data: order } = await supabase
      .from("orders")
      .select("created_by, assigned_to")
      .eq("id", tokenRow.order_id)
      .single();

    const uniqueIds = [
      ...new Set([order?.created_by, order?.assigned_to].filter((id): id is string => !!id)),
    ];

    for (const userId of uniqueIds) {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: hasRevision ? "artwork_adjustment" : "artwork_approved",
        title: hasRevision ? "Ajuste solicitado no lote" : "Lote de artes aprovado",
        message: `${approverName}: ${historyMsg}`,
        data: { order_id: tokenRow.order_id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Bundle approval error:", err);
    return NextResponse.json({ error: "Erro ao processar decisões" }, { status: 500 });
  }
}
