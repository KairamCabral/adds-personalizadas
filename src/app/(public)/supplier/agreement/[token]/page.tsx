import { validateAgreementToken } from "@/services/agreements.service";
import { AgreementContent } from "./_components/agreement-content";
import { SignatureForm } from "./_components/signature-form";
import { formatDate } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SupplierAgreementPage({ params }: PageProps) {
  const { token } = await params;
  const result = await validateAgreementToken(token);

  if (!result.agreement && !result.supplier) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <div className="w-full rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-lg">
          <h2 className="text-lg font-semibold text-destructive">
            Link inválido ou expirado
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Este link de assinatura não é válido ou expirou. Entre em contato com
            a ADDS para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (result.agreement?.status === "signed") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <div className="w-full rounded-xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-center text-lg font-semibold text-foreground">
            Termo já assinado
          </h2>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Este termo foi assinado em{" "}
            {result.agreement.signed_at
              ? formatDate(result.agreement.signed_at)
              : "—"}{" "}
            por {result.agreement.signer_name ?? "—"}.
          </p>
          {result.agreement.agreement_hash && (
            <p className="mt-2 text-center text-xs text-muted-foreground font-mono">
              Hash: {result.agreement.agreement_hash.slice(0, 16)}...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (result.agreement?.status === "revoked") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <div className="w-full rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-lg">
          <h2 className="text-lg font-semibold text-destructive">
            Termo revogado
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Este termo foi revogado e não está mais em vigor. Entre em contato
            com a ADDS para mais informações.
          </p>
        </div>
      </div>
    );
  }

  if (!result.is_valid) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <div className="w-full rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-lg">
          <h2 className="text-lg font-semibold text-destructive">
            Link inválido ou expirado
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Este link de assinatura não é válido ou expirou. Entre em contato
            com a ADDS para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center p-6">
      <div className="w-full rounded-xl border border-border bg-card shadow-lg">
        <div className="border-b border-border p-6 text-center">
          <div className="mb-2 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card ring-1 ring-border">
              <Logo size="sm" className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-lg font-bold text-foreground">ADDS CRM</h1>
          <p className="mt-1 text-sm font-medium text-primary">
            {result.supplier?.name ?? "Fornecedor"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Termo de Confidencialidade e Uso de Dados
          </p>
        </div>

        <div className="p-6">
          <AgreementContent />
          <SignatureForm token={token} />
        </div>
      </div>
    </div>
  );
}
