import { getEditionBySlug } from "@/lib/congressos/edition.server";
import { CongressoWizard } from "./_components/congresso-wizard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function StateCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-adds-navy">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

function firstStr(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function CongressoLandingPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const edition = await getEditionBySlug(slug);

  if (!edition) {
    return (
      <StateCard
        title="Evento não encontrado"
        message="Confira o link ou o QR do estande."
      />
    );
  }
  if (!edition.is_active) {
    return (
      <StateCard
        title="Pré-cadastro indisponível"
        message="O pré-cadastro deste congresso não está aberto no momento."
      />
    );
  }

  return (
    <CongressoWizard
      slug={edition.slug}
      editionName={edition.name}
      giftName={edition.gift_name}
      turnstileEnabled={edition.turnstile_enabled}
      utm={{
        source: firstStr(sp.utm_source),
        medium: firstStr(sp.utm_medium),
        campaign: firstStr(sp.utm_campaign),
        content: firstStr(sp.utm_content),
      }}
    />
  );
}
