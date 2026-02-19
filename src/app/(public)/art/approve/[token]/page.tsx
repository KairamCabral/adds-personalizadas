import { createClient } from "@/lib/supabase/server";
import { ApprovalForm } from "./_components/approval-form";

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
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.
        </p>
      </div>
    );
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const result = rows[0];

  if (!result || !result.is_valid) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-xl ring-1 ring-border/50 dark:bg-gray-900 sm:p-8">
        <h2 className="text-lg font-semibold text-destructive sm:text-xl">
          Link inválido ou expirado
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Este link de aprovação expirou ou já foi utilizado.
        </p>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          Entre em contato com a ADDS para solicitar um novo link.
        </p>
      </div>
    );
  }

  const variations = rows.map((r) => ({
    id: r.artwork_id,
    url: r.artwork_url ?? "",
    variationIndex: r.variation_index ?? 1,
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-xl ring-1 ring-border/50 dark:bg-gray-900 sm:p-4 lg:p-5">
      <ApprovalForm
        token={token}
        orderTitle={result.order_title ?? ""}
        variations={variations}
      />
    </div>
  );
}
