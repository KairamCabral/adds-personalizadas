import { createClient } from "@/lib/supabase/server";

import { NpsForm } from "./_components/nps-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ score?: string }>;
}

function parseScore(s?: string): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

function StateCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-[#0b4269]">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function NpsSurveyPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { score } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_nps_token", { p_token: token });
  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row) {
    return (
      <StateCard
        title="Link inválido"
        message="Não encontramos esta pesquisa. Confira o link que você recebeu."
      />
    );
  }
  if (row.already_responded) {
    return (
      <StateCard
        title="Resposta já registrada 💙"
        message="Você já respondeu esta pesquisa. Muito obrigado pelo seu retorno!"
      />
    );
  }
  if (row.is_expired || !row.is_valid) {
    return (
      <StateCard
        title="Pesquisa encerrada"
        message="O prazo para responder esta pesquisa expirou. Obrigado pelo interesse!"
      />
    );
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <NpsForm
        token={token}
        clientName={row.client_name}
        orderTitle={row.order_title}
        questions={{
          main: row.question_main,
          detractor: row.question_detractor,
          passive: row.question_passive,
          promoter: row.question_promoter,
        }}
        initialScore={parseScore(score)}
      />
    </main>
  );
}
