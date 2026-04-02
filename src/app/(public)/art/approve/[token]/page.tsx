import { createClient } from "@/lib/supabase/server";
import { ApprovalForm } from "./_components/approval-form";
import { ReadOnlyView } from "./_components/read-only-view";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ArtApprovalPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("validate_approval_token", {
    p_token: token,
  });

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-xl ring-1 ring-border/50 dark:bg-gray-900 sm:p-8">
        <h2 className="text-lg font-semibold text-destructive sm:text-xl">
          Erro ao validar link
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente ou entre em contato com a ADDS.
        </p>
      </div>
    );
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const result = rows[0];

  if (!result) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-xl ring-1 ring-border/50 dark:bg-gray-900 sm:p-8">
        <h2 className="text-lg font-semibold text-destructive sm:text-xl">
          Link inválido
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link de aprovação não foi encontrado.
        </p>
      </div>
    );
  }

  if (!result.is_valid && !result.is_viewable) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-xl ring-1 ring-border/50 dark:bg-gray-900 sm:p-8">
        <h2 className="text-lg font-semibold text-destructive sm:text-xl">
          Link expirado
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link de aprovação expirou. Entre em contato com a ADDS para solicitar um novo.
        </p>
      </div>
    );
  }

  const isBundle = result.is_bundle ?? false;

  const variations = rows.map((r) => ({
    id: r.artwork_id,
    url: r.artwork_url ?? "",
    variationIndex: r.variation_index ?? 1,
    label: r.artwork_label ?? null,
    status: r.artwork_status ?? "PENDENTE",
  }));

  const isReadOnly = !result.is_valid && result.is_viewable;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-xl ring-1 ring-border/50 dark:bg-gray-900 sm:p-4 lg:p-5">
      {isReadOnly ? (
        <ReadOnlyView
          orderTitle={result.order_title ?? ""}
          variations={variations}
          artworkStatus={result.artwork_status ?? null}
          approvedBy={result.used_by_name ?? null}
          isBundle={isBundle}
        />
      ) : (
        <ApprovalForm
          token={token}
          orderTitle={result.order_title ?? ""}
          variations={variations}
          isBundle={isBundle}
        />
      )}
    </div>
  );
}
